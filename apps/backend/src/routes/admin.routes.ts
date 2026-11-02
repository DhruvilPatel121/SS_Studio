import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../config/database'
import { requireAdmin } from '../middleware/auth.middleware'
import { parsePagination, buildPaginatedResponse } from '../utils/helpers'

export const adminRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', requireAdmin())

  // GET /api/v1/admin/photos — admin view all photos with filters
  app.get('/photos', async (request, reply) => {
    const query = request.query as { eventId?: string; status?: string; page?: string; limit?: string }
    const { page, limit, skip } = parsePagination(query)

    const where: any = { deletedAt: null }
    if (query.eventId) where.eventId = query.eventId
    if (query.status) where.status = query.status

    const [photos, total] = await Promise.all([
      prisma.photo.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: { group: { select: { id: true, name: true } }, event: { select: { id: true, name: true } } },
      }),
      prisma.photo.count({ where }),
    ])

    return reply.send({ success: true, ...buildPaginatedResponse(photos, total, page, limit) })
  })

  // GET /api/v1/admin/faces — all detected faces
  app.get('/faces', async (request, reply) => {
    const query = request.query as { eventId?: string; page?: string; limit?: string }
    const { page, limit, skip } = parsePagination(query)

    const where: any = {}
    if (query.eventId) where.eventId = query.eventId

    const [faces, total] = await Promise.all([
      prisma.photoFace.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          photo: { select: { id: true, thumbnailPath: true } },
          guestProfile: { select: { id: true, name: true } },
        },
      }),
      prisma.photoFace.count({ where }),
    ])

    return reply.send({ success: true, ...buildPaginatedResponse(faces, total, page, limit) })
  })

  // GET /api/v1/admin/storage — storage statistics
  app.get('/storage', async (_request, reply) => {
    const stats = await prisma.eventAnalytics.aggregate({
      _sum: { storageUsedBytes: true, totalPhotos: true },
    })

    return reply.send({ success: true, data: stats })
  })
}