import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../config/database'
import { requirePhotographer } from '../middleware/auth.middleware'
import { requireEventAccess } from '../middleware/event.middleware'
import { auditService } from '../services/audit.service'
import { generateUniqueSlug, generateSlug, parsePagination, buildPaginatedResponse } from '../utils/helpers'
import { notFound, conflict } from '../utils/errors'

const createEventSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  eventDate: z.string().datetime().optional(),
  location: z.string().max(500).optional(),
  timezone: z.string().default('Asia/Kolkata'),
  privacy: z.enum(['PUBLIC', 'PRIVATE', 'INVITE_ONLY']).default('PRIVATE'),
  theme: z.enum(['CLASSIC', 'MINIMAL', 'LUXURY', 'WEDDING', 'DARK', 'LIGHT', 'EDITORIAL', 'MODERN']).default('MODERN'),
  expiresAt: z.string().datetime().optional(),
  faceDataRetention: z.enum(['DAYS_30', 'DAYS_90', 'YEAR_1', 'UNTIL_EVENT_DELETION']).default('UNTIL_EVENT_DELETION'),
  isIndexable: z.boolean().default(false),
})

const updateEventSchema = createEventSchema.partial()

export const eventRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/v1/events — list photographer's events
  app.get('/', { preHandler: [app.authenticate, requirePhotographer()] }, async (request, reply) => {
    const user = request.user as { sub: string; role: string }
    const query = request.query as { page?: string; limit?: string; status?: string; search?: string }
    const { page, limit, skip } = parsePagination(query)

    const where: any = { deletedAt: null }
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      where.ownerId = user.sub
    }
    if (query.status) where.status = query.status
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ]
    }

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { photos: true, groups: true, guestProfiles: true } },
          analytics: true,
        },
      }),
      prisma.event.count({ where }),
    ])

    return reply.send({ success: true, ...buildPaginatedResponse(events, total, page, limit) })
  })

  // POST /api/v1/events
  app.post('/', { preHandler: [app.authenticate, requirePhotographer()] }, async (request, reply) => {
    const user = request.user as { sub: string }
    const body = createEventSchema.parse(request.body)
    const slug = generateUniqueSlug(body.name)

    const event = await prisma.event.create({
      data: {
        ...body,
        slug,
        ownerId: user.sub,
        eventDate: body.eventDate ? new Date(body.eventDate) : undefined,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
        analytics: { create: {} },
      },
      include: { analytics: true },
    })

    await auditService.log({ userId: user.sub, eventId: event.id, action: 'CREATE_EVENT', ipAddress: request.ip })
    return reply.code(201).send({ success: true, data: event })
  })

  // GET /api/v1/events/:eventId
  app.get('/:eventId', { preHandler: [app.authenticate, requireEventAccess] }, async (request, reply) => {
    const { eventId } = request.params as { eventId: string }
    const event = await prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        groups: { orderBy: { sortOrder: 'asc' } },
        analytics: true,
        _count: { select: { photos: true, guestProfiles: true, qrCodes: true } },
      },
    })
    if (!event) throw notFound('Event')
    return reply.send({ success: true, data: event })
  })

  // PATCH /api/v1/events/:eventId
  app.patch('/:eventId', { preHandler: [app.authenticate, requireEventAccess] }, async (request, reply) => {
    const user = request.user as { sub: string }
    const { eventId } = request.params as { eventId: string }
    const body = updateEventSchema.parse(request.body)

    const event = await prisma.event.update({
      where: { id: eventId },
      data: {
        ...body,
        eventDate: body.eventDate ? new Date(body.eventDate) : undefined,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      },
    })

    await auditService.log({ userId: user.sub, eventId, action: 'UPDATE_EVENT', ipAddress: request.ip })
    return reply.send({ success: true, data: event })
  })

  // DELETE /api/v1/events/:eventId (soft delete)
  app.delete('/:eventId', { preHandler: [app.authenticate, requireEventAccess] }, async (request, reply) => {
    const user = request.user as { sub: string }
    const { eventId } = request.params as { eventId: string }

    await prisma.event.update({
      where: { id: eventId },
      data: { deletedAt: new Date(), status: 'DELETED' },
    })

    await auditService.log({ userId: user.sub, eventId, action: 'DELETE_EVENT', ipAddress: request.ip })
    return reply.send({ success: true })
  })

  // POST /api/v1/events/:eventId/archive
  app.post('/:eventId/archive', { preHandler: [app.authenticate, requireEventAccess] }, async (request, reply) => {
    const user = request.user as { sub: string }
    const { eventId } = request.params as { eventId: string }
    await prisma.event.update({ where: { id: eventId }, data: { status: 'ARCHIVED' } })
    await auditService.log({ userId: user.sub, eventId, action: 'ARCHIVE_EVENT', ipAddress: request.ip })
    return reply.send({ success: true })
  })

  // POST /api/v1/events/:eventId/restore
  app.post('/:eventId/restore', { preHandler: [app.authenticate, requireEventAccess] }, async (request, reply) => {
    const { eventId } = request.params as { eventId: string }
    await prisma.event.update({ where: { id: eventId }, data: { deletedAt: null, status: 'ACTIVE' } })
    return reply.send({ success: true })
  })

  // GET /api/v1/events/:eventId/stats
  app.get('/:eventId/stats', { preHandler: [app.authenticate, requireEventAccess] }, async (request, reply) => {
    const { eventId } = request.params as { eventId: string }
    const [photoStats, analytics] = await Promise.all([
      prisma.photo.groupBy({
        by: ['status'],
        where: { eventId, deletedAt: null },
        _count: true,
      }),
      prisma.eventAnalytics.findUnique({ where: { eventId } }),
    ])
    return reply.send({ success: true, data: { photoStats, analytics } })
  })
}