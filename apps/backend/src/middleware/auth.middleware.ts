import type { FastifyRequest, FastifyReply } from 'fastify'
import { AppError, forbidden } from '../utils/errors'
import type { Role } from '@prisma/client'

// Role hierarchy
const ROLE_HIERARCHY: Record<Role, number> = {
  SUPER_ADMIN: 100,
  ADMIN: 80,
  PHOTOGRAPHER: 60,
  STAFF: 40,
  GUEST: 20,
}

export function hasRole(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
}

export function requireRole(...roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify()
    } catch {
      return reply.code(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      })
    }

    const user = request.user as { role: Role }
    const allowed = roles.some(r => hasRole(user.role, r))
    if (!allowed) {
      return reply.code(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
      })
    }
  }
}

export function requireSuperAdmin() {
  return requireRole('SUPER_ADMIN')
}

export function requireAdmin() {
  return requireRole('ADMIN', 'SUPER_ADMIN')
}

export function requirePhotographer() {
  return requireRole('PHOTOGRAPHER', 'ADMIN', 'SUPER_ADMIN')
}

export function optionalAuth() {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    try {
      await request.jwtVerify()
    } catch {
      // Optional — just continue without user
    }
  }
}