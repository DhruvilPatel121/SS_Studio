import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { authService } from '../services/auth.service'
import { auditService } from '../services/audit.service'
import { AppError } from '../utils/errors'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2).max(100),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8),
})

const refreshSchema = z.object({
  refreshToken: z.string(),
})

export const authRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/v1/auth/register
  app.post('/register', async (request, reply) => {
    const body = registerSchema.parse(request.body)
    const user = await authService.register(body)
    await auditService.log({
      userId: user.id,
      action: 'REGISTER',
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    })
    return reply.code(201).send({ success: true, data: user })
  })

  // POST /api/v1/auth/login
  app.post('/login', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const body = loginSchema.parse(request.body)
    const result = await authService.login(body, app)
    await auditService.log({
      userId: result.user.id,
      action: 'LOGIN',
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    })
    reply.setCookie('auth_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    })
    return reply.send({ success: true, data: result })
  })

  // POST /api/v1/auth/logout
  app.post('/logout', { preHandler: [app.authenticate] }, async (request, reply) => {
    const body = request.body as { refreshToken?: string }
    if (body?.refreshToken) {
      await authService.logout(body.refreshToken)
    }
    const user = request.user as { sub: string }
    await auditService.log({
      userId: user.sub,
      action: 'LOGOUT',
      ipAddress: request.ip,
    })
    reply.clearCookie('auth_token')
    return reply.send({ success: true })
  })

  // POST /api/v1/auth/refresh
  app.post('/refresh', async (request, reply) => {
    const body = refreshSchema.parse(request.body)
    const result = await authService.refreshToken(body.refreshToken, app)
    return reply.send({ success: true, data: result })
  })

  // POST /api/v1/auth/forgot-password
  app.post('/forgot-password', {
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
  }, async (request, reply) => {
    const body = forgotPasswordSchema.parse(request.body)
    await authService.requestPasswordReset(body.email)
    // Always return 200 to prevent email enumeration
    return reply.send({ success: true, message: 'If the email exists, a reset link will be sent.' })
  })

  // POST /api/v1/auth/reset-password
  app.post('/reset-password', async (request, reply) => {
    const body = resetPasswordSchema.parse(request.body)
    await authService.resetPassword(body.token, body.password)
    return reply.send({ success: true, message: 'Password reset successfully' })
  })

  // GET /api/v1/auth/me
  app.get('/me', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as { sub: string }
    const { prisma } = app as any
    const profile = await prisma.user.findUnique({
      where: { id: user.sub },
      select: { id: true, email: true, name: true, role: true, avatarUrl: true, createdAt: true, lastLoginAt: true },
    })
    if (!profile) return reply.code(404).send({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } })
    return reply.send({ success: true, data: profile })
  })
}