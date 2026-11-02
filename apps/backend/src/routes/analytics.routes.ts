import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../config/database'

export const analyticsRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/v1/analytics/event/:eventId
  app.get('/event/:eventId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { eventId } = request.params as { eventId: string }

    const [analytics, photoStatusBreakdown, groupStats, recentDownloads] = await Promise.all([
      prisma.eventAnalytics.findUnique({ where: { eventId } }),
      prisma.photo.groupBy({ by: ['status'], where: { eventId, deletedAt: null }, _count: true }),
      prisma.eventGroup.findMany({
        where: { eventId },
        select: { id: true, name: true, _count: { select: { photos: true } } },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.download.findMany({
        where: { photo: { eventId } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { photo: { select: { id: true, originalName: true, thumbnailPath: true } } },
      }),
    ])

    return reply.send({ success: true, data: { analytics, photoStatusBreakdown, groupStats, recentDownloads } })
  })

  // GET /api/v1/analytics/photographer — overall photographer stats
  app.get('/photographer', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as { sub: string }

    const [eventCount, totalPhotos, totalFaces, totalGuests, totalDownloads] = await Promise.all([
      prisma.event.count({ where: { ownerId: user.sub, deletedAt: null } }),
      prisma.photo.count({ where: { event: { ownerId: user.sub }, deletedAt: null } }),
      prisma.photoFace.count({ where: { photo: { event: { ownerId: user.sub } } } }),
      prisma.guestProfile.count({ where: { event: { ownerId: user.sub } } }),
      prisma.download.count({ where: { photo: { event: { ownerId: user.sub } } } }),
    ])

    const processingQueue = await prisma.photo.groupBy({
      by: ['status'],
      where: { event: { ownerId: user.sub }, deletedAt: null },
      _count: true,
    })

    return reply.send({
      success: true,
      data: { eventCount, totalPhotos, totalFaces, totalGuests, totalDownloads, processingQueue },
    })
  })
}