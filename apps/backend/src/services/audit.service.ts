import { prisma } from '../config/database'
import type { AuditAction } from '@prisma/client'

interface AuditLogInput {
  userId?: string
  eventId?: string
  action: AuditAction
  resourceType?: string
  resourceId?: string
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, unknown>
}

export const auditService = {
  async log(input: AuditLogInput): Promise<void> {
    await prisma.auditLog.create({ data: input }).catch(() => {
      // Never let audit logging break the main request
    })
  },
}