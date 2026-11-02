import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../config/database'
import { requirePhotographer } from '../middleware/auth.middleware'
import { z } from 'zod'

export const teamRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/v1/teams/:eventId
  app.get('/:eventId', { preHandler: [app.authenticate, requirePhotographer()] }, async (request, reply) => {
    const { eventId } = request.params as { eventId: string }
    const members = await prisma.teamMember.findMany({
      where: { eventId },
      include: { user: { select: { id: true, name: true, email: true, role: true, avatarUrl: true } } },
    })
    return reply.send({ success: true, data: members })
  })

  // POST /api/v1/teams/:eventId/invite
  app.post('/:eventId/invite', { preHandler: [app.authenticate, requirePhotographer()] }, async (request, reply) => {
    const { eventId } = request.params as { eventId: string }
    const body = request.body as { email: string; role: string }

    const user = await prisma.user.findUnique({ where: { email: body.email } })
    if (!user) return reply.code(404).send({ success: false, error: { code: 'USER_NOT_FOUND', message: 'No account with that email' } })

    const existing = await prisma.teamMember.findFirst({ where: { eventId, userId: user.id } })
    if (existing) return reply.code(409).send({ success: false, error: { code: 'ALREADY_MEMBER', message: 'User is already a team member' } })

    const member = await prisma.teamMember.create({
      data: { eventId, userId: user.id, role: body.role as any },
      include: { user: { select: { id: true, name: true, email: true } } },
    })

    return reply.code(201).send({ success: true, data: member })
  })

  // DELETE /api/v1/teams/:eventId/members/:userId
  app.delete('/:eventId/members/:userId', { preHandler: [app.authenticate, requirePhotographer()] }, async (request, reply) => {
    const { eventId, userId } = request.params as { eventId: string; userId: string }
    await prisma.teamMember.deleteMany({ where: { eventId, userId } })
    return reply.send({ success: true })
  })
}