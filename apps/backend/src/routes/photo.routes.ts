import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../config/database'
import { requirePhotographer } from '../middleware/auth.middleware'
import { requireEventAccess } from '../middleware/event.middleware'
import { parsePagination, buildPaginatedResponse } from '../utils/helpers'
import { notFound } from '../utils/errors'
import { auditService } from '../services/audit.service'
import { z } from 'zod'

const movePhotoSchema = z.object({ groupId: z.string().uuid().nullable() })

export const photoRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/v1/photos?eventId=&groupId=&status=&page=&limit=
  app.get('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as { sub: string; role: string }
    const query = request.query as {
      eventId?: string; groupId?: string; status?: string
      page?: string; limit?: string; search?: string
      hasFaces?: string; favorites?: string
    }

    if (!query.eventId) return reply.code(400).send({ success: false, error: { code: 'MISSING_EVENT_ID', message: 'eventId is required' } })

    // Verify access
    const event = await prisma.event.findFirst({
      where: { id: query.eventId, deletedAt: null },
    })
    if (!event) throw notFound('Event')

    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN' && event.ownerId !== user.sub) {
      const member = await prisma.teamMember.findFirst({ where: { eventId: query.eventId, userId: user.sub } })
      if (!member) return reply.code(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } })
    }

    const { page, limit, skip } = parsePagination(query)
    const where: any = { eventId: query.eventId, deletedAt: null }
    if (query.groupId) where.groupId = query.groupId
    if (query.status) where.status = query.status
    if (query.hasFaces === 'true') where.faceCount = { gt: 0 }
    if (query.search) {
      where.OR = [{ originalName: { contains: query.search, mode: 'insensitive' } }]
    }

    const [photos, total] = await Promise.all([
      prisma.photo.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          faces: { select: { id: true, bboxX: true, bboxY: true, bboxW: true, bboxH: true, detectionConf: true, qualityScore: true, guestProfileId: true } },
          group: { select: { id: true, name: true } },
        },
      }),
      prisma.photo.count({ where }),
    ])

    return reply.send({ success: true, ...buildPaginatedResponse(photos, total, page, limit) })
  })

  // GET /api/v1/photos/:photoId
  app.get('/:photoId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { photoId } = request.params as { photoId: string }
    const photo = await prisma.photo.findFirst({
      where: { id: photoId, deletedAt: null },
      include: {
        faces: {
          include: { guestProfile: { select: { id: true, name: true } } },
        },
        group: true,
        _count: { select: { downloads: true, favorites: true } },
      },
    })
    if (!photo) throw notFound('Photo')
    return reply.send({ success: true, data: photo })
  })

  // PATCH /api/v1/photos/:photoId/move
  app.patch('/:photoId/move', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { photoId } = request.params as { photoId: string }
    const body = movePhotoSchema.parse(request.body)
    const user = request.user as { sub: string }

    const photo = await prisma.photo.update({
      where: { id: photoId },
      data: { groupId: body.groupId },
    })

    await auditService.log({ userId: user.sub, action: 'MOVE_PHOTO', resourceType: 'photo', resourceId: photoId })
    return reply.send({ success: true, data: photo })
  })

  // DELETE /api/v1/photos/:photoId
  app.delete('/:photoId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { photoId } = request.params as { photoId: string }
    const user = request.user as { sub: string }

    await prisma.photo.update({
      where: { id: photoId },
      data: { deletedAt: new Date(), status: 'DELETED' },
    })

    await auditService.log({ userId: user.sub, action: 'DELETE_PHOTO', resourceType: 'photo', resourceId: photoId })
    return reply.send({ success: true })
  })

  // POST /api/v1/photos/bulk-delete
  app.post('/bulk-delete', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as { sub: string }
    const body = request.body as { photoIds: string[] }

    await prisma.photo.updateMany({
      where: { id: { in: body.photoIds } },
      data: { deletedAt: new Date(), status: 'DELETED' },
    })

    return reply.send({ success: true, deleted: body.photoIds.length })
  })

  // POST /api/v1/photos/bulk-move
  app.post('/bulk-move', { preHandler: [app.authenticate] }, async (request, reply) => {
    const body = request.body as { photoIds: string[]; groupId: string | null }
    await prisma.photo.updateMany({
      where: { id: { in: body.photoIds } },
      data: { groupId: body.groupId },
    })
    return reply.send({ success: true })
  })

  // POST /api/v1/photos/:photoId/reprocess
  app.post('/:photoId/reprocess', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { photoId } = request.params as { photoId: string }
    const user = request.user as { sub: string }

    await prisma.photo.update({
      where: { id: photoId },
      data: { status: 'UPLOADED', processingError: null },
    })

    // Queue reprocessing job
    const { photoQueue } = await import('../workers/queues')
    await photoQueue.add('FACE_DETECTION', { photoId }, { attempts: 3 })

    await auditService.log({ userId: user.sub, action: 'REPROCESS_PHOTO', resourceType: 'photo', resourceId: photoId })
    return reply.send({ success: true, message: 'Photo queued for reprocessing' })
  })

  // GET /api/v1/photos/:photoId/signed-url
  app.get('/:photoId/signed-url', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { photoId } = request.params as { photoId: string }
    const query = request.query as { type?: 'original' | 'thumbnail' | 'preview' }

    const photo = await prisma.photo.findFirst({ where: { id: photoId, deletedAt: null } })
    if (!photo) throw notFound('Photo')

    const { storage } = await import('../services/storage.service')
    const key = query.type === 'thumbnail' ? photo.thumbnailPath
      : query.type === 'preview' ? photo.previewPath
      : photo.storagePath

    if (!key) return reply.code(404).send({ success: false, error: { code: 'VARIANT_NOT_READY', message: 'Image variant not ready' } })

    const url = await storage.getSignedUrl(key, 3600)
    return reply.send({ success: true, data: { url, expiresIn: 3600 } })
  })
}