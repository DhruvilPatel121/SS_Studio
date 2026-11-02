import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../config/database'
import { requirePhotographer } from '../middleware/auth.middleware'
import { requireEventAccess } from '../middleware/event.middleware'
import { generateUniqueSlug } from '../utils/helpers'
import { notFound } from '../utils/errors'
import { auditService } from '../services/audit.service'

const createGroupSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  privacy: z.enum(['PUBLIC', 'PRIVATE', 'FACE_ONLY', 'FULL_ACCESS', 'ANONYMOUS_FACE_ACCESS']).default('PUBLIC'),
  password: z.string().optional(),
  isFaceMatchEnabled: z.boolean().default(true),
  isDownloadEnabled: z.boolean().default(true),
  watermarkType: z.enum(['NONE', 'TEXT', 'LOGO']).default('NONE'),
  sortOrder: z.number().default(0),
  expiresAt: z.string().datetime().optional(),
})

const updateGroupSchema = createGroupSchema.partial()

export const groupRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/v1/events/:eventId/groups
  app.get('/:eventId/groups', { preHandler: [app.authenticate, requireEventAccess] }, async (request, reply) => {
    const { eventId } = request.params as { eventId: string }
    const groups = await prisma.eventGroup.findMany({
      where: { eventId },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { photos: true } },
        qrCodes: { take: 1, orderBy: { createdAt: 'desc' } },
      },
    })
    return reply.send({ success: true, data: groups })
  })

  // POST /api/v1/events/:eventId/groups
  app.post('/:eventId/groups', { preHandler: [app.authenticate, requireEventAccess] }, async (request, reply) => {
    const user = request.user as { sub: string }
    const { eventId } = request.params as { eventId: string }
    const body = createGroupSchema.parse(request.body)
    const slug = generateUniqueSlug(body.name)

    const { password, ...rest } = body
    let passwordHash: string | undefined
    if (password) {
      const bcrypt = await import('bcryptjs')
      passwordHash = await bcrypt.hash(password, 10)
    }

    const group = await prisma.eventGroup.create({
      data: {
        ...rest,
        slug,
        eventId,
        passwordHash,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      },
    })

    await auditService.log({ userId: user.sub, eventId, action: 'CREATE_GROUP', resourceType: 'group', resourceId: group.id })
    return reply.code(201).send({ success: true, data: group })
  })

  // GET /api/v1/events/:eventId/groups/:groupId
  app.get('/:eventId/groups/:groupId', { preHandler: [app.authenticate, requireEventAccess] }, async (request, reply) => {
    const { eventId, groupId } = request.params as { eventId: string; groupId: string }
    const group = await prisma.eventGroup.findFirst({
      where: { id: groupId, eventId },
      include: { _count: { select: { photos: true } } },
    })
    if (!group) throw notFound('Group')
    return reply.send({ success: true, data: group })
  })

  // PATCH /api/v1/events/:eventId/groups/:groupId
  app.patch('/:eventId/groups/:groupId', { preHandler: [app.authenticate, requireEventAccess] }, async (request, reply) => {
    const user = request.user as { sub: string }
    const { eventId, groupId } = request.params as { eventId: string; groupId: string }
    const body = updateGroupSchema.parse(request.body)

    const { password, ...rest } = body
    let passwordHash: string | undefined
    if (password) {
      const bcrypt = await import('bcryptjs')
      passwordHash = await bcrypt.hash(password, 10)
    }

    const group = await prisma.eventGroup.update({
      where: { id: groupId },
      data: {
        ...rest,
        ...(passwordHash ? { passwordHash } : {}),
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      },
    })

    await auditService.log({ userId: user.sub, eventId, action: 'UPDATE_GROUP', resourceType: 'group', resourceId: groupId })
    return reply.send({ success: true, data: group })
  })

  // DELETE /api/v1/events/:eventId/groups/:groupId
  app.delete('/:eventId/groups/:groupId', { preHandler: [app.authenticate, requireEventAccess] }, async (request, reply) => {
    const user = request.user as { sub: string }
    const { eventId, groupId } = request.params as { eventId: string; groupId: string }
    await prisma.eventGroup.delete({ where: { id: groupId } })
    await auditService.log({ userId: user.sub, eventId, action: 'DELETE_GROUP', resourceType: 'group', resourceId: groupId })
    return reply.send({ success: true })
  })

  // POST /api/v1/events/:eventId/groups/reorder
  app.post('/:eventId/groups/reorder', { preHandler: [app.authenticate, requireEventAccess] }, async (request, reply) => {
    const { eventId } = request.params as { eventId: string }
    const body = request.body as { order: Array<{ id: string; sortOrder: number }> }

    await prisma.$transaction(
      body.order.map(({ id, sortOrder }) =>
        prisma.eventGroup.update({ where: { id }, data: { sortOrder } })
      )
    )

    return reply.send({ success: true })
  })
}