import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../config/database'
import { storage } from '../services/storage.service'
import { auditService } from '../services/audit.service'
import { notFound } from '../utils/errors'
import { photoQueue } from '../workers/queues'

export const downloadRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/v1/downloads/single/:photoId
  app.post('/single/:photoId', async (request, reply) => {
    const { photoId } = request.params as { photoId: string }
    const body = request.body as { guestSessionToken?: string; type?: 'original' | 'compressed' }
    const user = request.user as { sub?: string } | null

    const photo = await prisma.photo.findFirst({ where: { id: photoId, deletedAt: null } })
    if (!photo) throw notFound('Photo')

    // Determine which path to serve
    const keyToServe = body?.type === 'compressed' && photo.previewPath
      ? photo.previewPath
      : photo.storagePath

    // Record download
    let guestId: string | null = null
    if (body?.guestSessionToken) {
      const guest = await prisma.guestProfile.findUnique({ where: { sessionToken: body.guestSessionToken } })
      guestId = guest?.id ?? null
    }

    await prisma.download.create({
      data: {
        photoId,
        guestProfileId: guestId,
        userId: user?.sub ?? null,
        downloadType: body?.type ?? 'original',
        ipAddress: request.ip,
      },
    })

    await prisma.photo.update({ where: { id: photoId }, data: { downloadCount: { increment: 1 } } })

    await auditService.log({
      userId: user?.sub,
      action: 'DOWNLOAD_PHOTO',
      resourceType: 'photo',
      resourceId: photoId,
      ipAddress: request.ip,
    })

    // Return signed URL
    const url = await storage.getSignedUrl(keyToServe, 300)
    return reply.send({ success: true, data: { url, expiresIn: 300 } })
  })

  // POST /api/v1/downloads/zip — async ZIP generation
  app.post('/zip', async (request, reply) => {
    const body = request.body as { photoIds: string[]; eventId: string; guestSessionToken?: string }
    if (!body.photoIds?.length) {
      return reply.code(400).send({ success: false, error: { code: 'NO_PHOTOS', message: 'No photos selected' } })
    }

    const job = await photoQueue.add('ZIP_GENERATION', {
      photoIds: body.photoIds,
      eventId: body.eventId,
      guestSessionToken: body.guestSessionToken,
      requestedAt: new Date().toISOString(),
    }, { attempts: 2 })

    // Create job record
    const dbJob = await prisma.processingJob.create({
      data: {
        eventId: body.eventId,
        type: 'ZIP_GENERATION',
        status: 'PENDING',
        bullJobId: String(job.id),
        metadata: { photoCount: body.photoIds.length },
      },
    })

    return reply.code(202).send({ success: true, data: { jobId: dbJob.id, message: 'ZIP generation started. Poll /status/:jobId for progress.' } })
  })

  // GET /api/v1/downloads/zip/status/:jobId
  app.get('/zip/status/:jobId', async (request, reply) => {
    const { jobId } = request.params as { jobId: string }
    const job = await prisma.processingJob.findUnique({ where: { id: jobId } })
    if (!job) return reply.code(404).send({ success: false, error: { code: 'JOB_NOT_FOUND', message: 'Job not found' } })

    const response: any = { success: true, data: { status: job.status, progress: job.progress } }

    if (job.status === 'COMPLETED' && job.metadata) {
      const meta = job.metadata as any
      if (meta.zipKey) {
        response.data.downloadUrl = await storage.getSignedUrl(meta.zipKey, 3600)
        response.data.expiresIn = 3600
      }
    }

    return reply.send(response)
  })

  // GET /api/v1/downloads/favorites — get guest favorites
  app.get('/favorites', async (request, reply) => {
    const query = request.query as { token: string; eventId: string }
    const guest = await prisma.guestProfile.findFirst({
      where: { sessionToken: query.token, eventId: query.eventId },
    })
    if (!guest) return reply.send({ success: true, data: [] })

    const favorites = await prisma.favorite.findMany({
      where: { guestProfileId: guest.id },
      include: { photo: { select: { id: true, thumbnailPath: true, originalName: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return reply.send({ success: true, data: favorites })
  })
}