import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../config/database'
import { AppError } from '../utils/errors'

// Verify the requesting user actually owns (or has access to) the event
export async function requireEventAccess(request: FastifyRequest<{ Params: { eventId: string } }>, reply: FastifyReply) {
  const user = request.user as { sub: string; role: string }
  const { eventId } = request.params

  const event = await prisma.event.findFirst({
    where: { id: eventId, deletedAt: null },
    select: { ownerId: true, status: true },
  })

  if (!event) {
    return reply.code(404).send({ success: false, error: { code: 'EVENT_NOT_FOUND', message: 'Event not found' } })
  }

  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return

  if (event.ownerId === user.sub) return

  // Check team membership
  const member = await prisma.teamMember.findFirst({
    where: { eventId, userId: user.sub },
  })
  if (!member) {
    return reply.code(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied to this event' } })
  }
}

// Verify event exists for guest access
export async function requirePublicEvent(request: FastifyRequest<{ Params: { slug: string } }>, reply: FastifyReply) {
  const { slug } = request.params
  const event = await prisma.event.findFirst({
    where: { slug, status: 'ACTIVE', deletedAt: null },
  })

  if (!event) {
    return reply.code(404).send({ success: false, error: { code: 'EVENT_NOT_FOUND', message: 'Event not found or has expired' } })
  }

  if (event.expiresAt && event.expiresAt < new Date()) {
    return reply.code(410).send({ success: false, error: { code: 'EVENT_EXPIRED', message: 'This event has expired' } })
  }

  ;(request as any).event = event
}