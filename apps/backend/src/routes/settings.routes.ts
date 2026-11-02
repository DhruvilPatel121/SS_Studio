import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../config/database'
import { requirePhotographer } from '../middleware/auth.middleware'

export const settingsRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/v1/settings/system — public settings (theme, name etc)
  app.get('/system', async (_request, reply) => {
    const settings = await prisma.systemSettings.findUnique({ where: { id: 'global' } })
    if (!settings) return reply.send({ success: true, data: null })
    const { maintenanceMode, maintenanceMessage, appName, logoUrl, defaultTheme } = settings
    return reply.send({ success: true, data: { maintenanceMode, maintenanceMessage, appName, logoUrl, defaultTheme } })
  })

  // GET /api/v1/settings/me
  app.get('/me', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as { sub: string }
    const profile = await prisma.user.findUnique({
      where: { id: user.sub },
      select: { id: true, email: true, name: true, role: true, avatarUrl: true },
    })
    return reply.send({ success: true, data: profile })
  })

  // PATCH /api/v1/settings/me
  app.patch('/me', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as { sub: string }
    const body = request.body as { name?: string; avatarUrl?: string }

    const updated = await prisma.user.update({
      where: { id: user.sub },
      data: body,
      select: { id: true, email: true, name: true, role: true, avatarUrl: true },
    })

    return reply.send({ success: true, data: updated })
  })

  // PATCH /api/v1/settings/change-password
  app.patch('/change-password', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as { sub: string }
    const body = request.body as { currentPassword: string; newPassword: string }

    const account = await prisma.user.findUnique({ where: { id: user.sub }, select: { passwordHash: true } })
    if (!account) return reply.code(404).send({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } })

    const { authService } = await import('../services/auth.service')
    const valid = await authService.verifyPassword(body.currentPassword, account.passwordHash)
    if (!valid) return reply.code(401).send({ success: false, error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect' } })

    const newHash = await authService.hashPassword(body.newPassword)
    await prisma.user.update({ where: { id: user.sub }, data: { passwordHash: newHash } })

    return reply.send({ success: true })
  })
}