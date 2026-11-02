import bcrypt from 'bcryptjs'
import { prisma } from '../config/database'
import { env } from '../config/env'
import { AppError } from '../utils/errors'
import { nanoid } from 'nanoid'
import { addDays, addHours } from '../utils/date'
import type { FastifyInstance } from 'fastify'
import type { Role } from '@prisma/client'

const BCRYPT_ROUNDS = 12

export interface RegisterInput {
  email: string
  password: string
  name: string
  role?: Role
}

export interface LoginInput {
  email: string
  password: string
}

export interface TokenPayload {
  sub: string
  email: string
  role: Role
  name: string
}

export const authService = {
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS)
  },

  async verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash)
  },

  async register(input: RegisterInput) {
    const existing = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } })
    if (existing) throw new AppError('EMAIL_TAKEN', 'An account with this email already exists', 409)

    const passwordHash = await this.hashPassword(input.password)
    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash,
        name: input.name,
        role: input.role ?? 'PHOTOGRAPHER',
      },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    })

    // Create default branding settings
    await prisma.brandingSettings.create({
      data: { userId: user.id },
    })

    return user
  },

  async login(input: LoginInput, app: FastifyInstance) {
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      select: {
        id: true, email: true, name: true, role: true,
        passwordHash: true, isActive: true,
      },
    })

    if (!user || !user.isActive) {
      throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401)
    }

    const valid = await this.verifyPassword(input.password, user.passwordHash)
    if (!valid) throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401)

    const payload: TokenPayload = { sub: user.id, email: user.email, role: user.role, name: user.name }
    const token = app.jwt.sign(payload, { expiresIn: env.JWT_EXPIRES_IN })
    const refreshToken = nanoid(64)

    await prisma.session.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: addDays(new Date(), 30),
      },
    })

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    return {
      token,
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    }
  },

  async logout(sessionToken: string) {
    await prisma.session.deleteMany({ where: { token: sessionToken } })
  },

  async refreshToken(refreshToken: string, app: FastifyInstance) {
    const session = await prisma.session.findUnique({
      where: { token: refreshToken },
      include: { user: { select: { id: true, email: true, role: true, name: true, isActive: true } } },
    })

    if (!session || session.expiresAt < new Date() || !session.user.isActive) {
      throw new AppError('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token', 401)
    }

    const payload: TokenPayload = {
      sub: session.user.id,
      email: session.user.email,
      role: session.user.role,
      name: session.user.name,
    }
    const newToken = app.jwt.sign(payload, { expiresIn: env.JWT_EXPIRES_IN })
    const newRefreshToken = nanoid(64)

    await prisma.session.update({
      where: { id: session.id },
      data: { token: newRefreshToken, expiresAt: addDays(new Date(), 30) },
    })

    return { token: newToken, refreshToken: newRefreshToken }
  },

  async requestPasswordReset(email: string) {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
    // Always respond the same to prevent enumeration
    if (!user) return null

    const token = nanoid(64)
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        token,
        expiresAt: addHours(new Date(), 2),
      },
    })

    // Log token to console (dev); in prod, send via SMTP
    console.info(`[PASSWORD RESET] Token for ${email}: ${token}`)
    return token
  },

  async resetPassword(token: string, newPassword: string) {
    const reset = await prisma.passwordReset.findUnique({
      where: { token },
      include: { user: true },
    })

    if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
      throw new AppError('INVALID_RESET_TOKEN', 'Invalid or expired reset token', 400)
    }

    const passwordHash = await this.hashPassword(newPassword)
    await prisma.$transaction([
      prisma.user.update({ where: { id: reset.userId }, data: { passwordHash } }),
      prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
      // Invalidate all existing sessions
      prisma.session.deleteMany({ where: { userId: reset.userId } }),
    ])
  },
}