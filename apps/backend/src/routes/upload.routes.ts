import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import path from 'path'
import { prisma } from '../config/database'
import { storage, buildStorageKey } from '../services/storage.service'
import { generateSha256, sanitizeFilename, generateToken } from '../utils/helpers'
import { auditService } from '../services/audit.service'
import { photoQueue } from '../workers/queues'
import { env } from '../config/env'
import { logger } from '../config/logger'

const ALLOWED_TYPES = env.ALLOWED_IMAGE_TYPES.split(',').map(t => t.trim())

export const uploadRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/v1/upload/photo
  // Handles single photo upload; called multiple times for bulk
  app.post('/photo', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as { sub: string }

    const data = await request.file()
    if (!data) return reply.code(400).send({ success: false, error: { code: 'NO_FILE', message: 'No file provided' } })

    const eventId = data.fields.eventId as any
    const groupId = (data.fields.groupId as any)?.value ?? null
    if (!eventId?.value) return reply.code(400).send({ success: false, error: { code: 'MISSING_EVENT_ID', message: 'eventId is required' } })

    const eId = eventId.value as string
    const gId = groupId as string | null

    // Validate MIME type
    const mimeType = data.mimetype
    if (!ALLOWED_TYPES.includes(mimeType)) {
      return reply.code(400).send({ success: false, error: { code: 'INVALID_FILE_TYPE', message: `File type ${mimeType} is not allowed` } })
    }

    // Read buffer
    const buffer = await data.toBuffer()

    // Validate size
    const maxBytes = env.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if (buffer.length > maxBytes) {
      return reply.code(400).send({ success: false, error: { code: 'FILE_TOO_LARGE', message: `File exceeds maximum size of ${env.MAX_UPLOAD_SIZE_MB}MB` } })
    }

    // Duplicate detection
    const sha256Hash = generateSha256(buffer)
    const duplicate = await prisma.photo.findFirst({
      where: { sha256Hash, eventId: eId, deletedAt: null },
    })
    if (duplicate) {
      return reply.code(200).send({
        success: true,
        duplicate: true,
        message: 'Duplicate photo skipped.',
        data: { id: duplicate.id },
      })
    }

    // Build storage key
    const ext = path.extname(data.filename) || '.jpg'
    const safeFilename = `${generateToken(16)}${ext}`
    const storageKey = buildStorageKey(eId, 'originals', safeFilename)

    // Upload to storage
    await storage.upload(storageKey, buffer, mimeType)

    // Get image dimensions
    let width: number | undefined, height: number | undefined
    try {
      const sharp = (await import('sharp')).default
      const meta = await sharp(buffer).metadata()
      width = meta.width
      height = meta.height
    } catch { /* dimensions optional */ }

    // Create photo record
    const photo = await prisma.photo.create({
      data: {
        eventId: eId,
        groupId: gId,
        originalName: sanitizeFilename(data.filename),
        storagePath: storageKey,
        mimeType,
        fileSize: buffer.length,
        width,
        height,
        sha256Hash,
        status: 'UPLOADED',
        uploadedById: user.sub,
      },
    })

    // Queue background processing
    await photoQueue.add('PHOTO_THUMBNAIL', { photoId: photo.id, eventId: eId }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    })

    // Update analytics
    await prisma.eventAnalytics.upsert({
      where: { eventId: eId },
      create: { eventId: eId, totalPhotos: 1, storageUsedBytes: BigInt(buffer.length) },
      update: {
        totalPhotos: { increment: 1 },
        storageUsedBytes: { increment: BigInt(buffer.length) },
      },
    })

    await auditService.log({
      userId: user.sub,
      eventId: eId,
      action: 'UPLOAD_PHOTO',
      resourceType: 'photo',
      resourceId: photo.id,
      ipAddress: request.ip,
    })

    return reply.code(201).send({ success: true, data: photo })
  })

  // GET /api/v1/upload/status/:jobId — check processing status
  app.get('/status/:jobId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { jobId } = request.params as { jobId: string }
    const job = await prisma.processingJob.findUnique({ where: { id: jobId } })
    if (!job) return reply.code(404).send({ success: false, error: { code: 'JOB_NOT_FOUND', message: 'Job not found' } })
    return reply.send({ success: true, data: job })
  })

  // GET /api/v1/upload/queue-stats/:eventId
  app.get('/queue-stats/:eventId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { eventId } = request.params as { eventId: string }
    const stats = await prisma.processingJob.groupBy({
      by: ['status'],
      where: { eventId },
      _count: true,
    })
    return reply.send({ success: true, data: stats })
  })
}