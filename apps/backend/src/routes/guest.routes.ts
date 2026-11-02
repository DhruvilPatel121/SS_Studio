import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../config/database'

// Public guest-facing routes — event landing, gallery access
export const guestRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/v1/guests/event/:slug — public event page data
  app.get('/event/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string }

    const event = await prisma.event.findFirst({
      where: { slug, status: 'ACTIVE', deletedAt: null },
      include: {
        owner: { select: { id: true, name: true } },
        groups: {
          where: { privacy: { not: 'PRIVATE' } },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true, name: true, slug: true, description: true,
            coverImageUrl: true, privacy: true, isFaceMatchEnabled: true,
            isDownloadEnabled: true, watermarkType: true,
            _count: { select: { photos: true } },
          },
        },
        _count: { select: { photos: true } },
      },
    })

    if (!event) return reply.code(404).send({ success: false, error: { code: 'EVENT_NOT_FOUND', message: 'Event not found' } })

    if (event.expiresAt && event.expiresAt < new Date()) {
      return reply.code(410).send({ success: false, error: { code: 'EVENT_EXPIRED', message: 'This event has expired' } })
    }

    // Get branding
    const branding = await prisma.brandingSettings.findUnique({ where: { userId: event.ownerId } })

    return reply.send({ success: true, data: { event, branding } })
  })

  // POST /api/v1/guests/session — create anonymous guest session
  app.post('/session', async (request, reply) => {
    const body = request.body as { eventId: string; name?: string; email?: string }
    if (!body.eventId) return reply.code(400).send({ success: false, error: { code: 'MISSING_EVENT_ID', message: 'eventId required' } })

    const { generateToken } = await import('../utils/helpers')
    const guest = await prisma.guestProfile.create({
      data: {
        eventId: body.eventId,
        sessionToken: generateToken(32),
        name: body.name,
        email: body.email,
      },
    })

    await prisma.eventAnalytics.upsert({
      where: { eventId: body.eventId },
      create: { eventId: body.eventId, totalGuests: 1 },
      update: { totalGuests: { increment: 1 } },
    })

    return reply.send({ success: true, data: { sessionToken: guest.sessionToken, guestId: guest.id } })
  })

  // GET /api/v1/guests/:eventId/list — photographer view of guests
  app.get('/:eventId/list', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { eventId } = request.params as { eventId: string }
    const query = request.query as { page?: string; limit?: string }

    const page = parseInt(query.page ?? '1', 10)
    const limit = Math.min(100, parseInt(query.limit ?? '20', 10))
    const skip = (page - 1) * limit

    const [guests, total] = await Promise.all([
      prisma.guestProfile.findMany({
        where: { eventId },
        skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { selfies: true, downloads: true, favorites: true } },
          selfies: { take: 1, orderBy: { createdAt: 'desc' }, select: { id: true, createdAt: true, isProcessed: true } },
        },
      }),
      prisma.guestProfile.count({ where: { eventId } }),
    ])

    return reply.send({
      success: true,
      data: guests,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit), hasNext: page * limit < total, hasPrev: page > 1 },
    })
  })

  // DELETE /api/v1/guests/:guestId — delete guest + their data
  app.delete('/:guestId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { guestId } = request.params as { guestId: string }
    await prisma.guestProfile.delete({ where: { id: guestId } })
    return reply.send({ success: true })
  })

  // DELETE /api/v1/guests/:guestId/face-data — delete only embeddings
  app.delete('/:guestId/face-data', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { guestId } = request.params as { guestId: string }

    // Remove embeddings from selfies
    await prisma.guestSelfie.updateMany({
      where: { guestProfileId: guestId },
      data: { embedding: null as any },
    })

    // Unlink faces
    await prisma.photoFace.updateMany({
      where: { guestProfileId: guestId },
      data: { guestProfileId: null },
    })

    return reply.send({ success: true, message: 'Face data deleted' })
  })
}