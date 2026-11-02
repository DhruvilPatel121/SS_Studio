import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../config/database'
import { storage, buildSelfieKey } from '../services/storage.service'
import { generateToken } from '../utils/helpers'
import { auditService } from '../services/audit.service'
import { env } from '../config/env'
import axios from 'axios'
import path from 'path'

const searchSchema = z.object({
  eventId: z.string().uuid(),
  groupId: z.string().uuid().optional(),
  guestSessionToken: z.string(),
})

export const faceRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/v1/faces/search-by-selfie
  // Guest uploads selfie, get matching photos back
  app.post('/search-by-selfie', {
    config: { rateLimit: { max: env.SELFIE_RATE_LIMIT_PER_MINUTE, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const data = await request.file()
    if (!data) return reply.code(400).send({ success: false, error: { code: 'NO_FILE', message: 'No selfie provided' } })

    const eventId = (data.fields.eventId as any)?.value
    const groupId = (data.fields.groupId as any)?.value ?? null
    const guestSessionToken = (data.fields.guestSessionToken as any)?.value

    if (!eventId) return reply.code(400).send({ success: false, error: { code: 'MISSING_EVENT_ID', message: 'eventId required' } })

    const mimeType = data.mimetype
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
      return reply.code(400).send({ success: false, error: { code: 'INVALID_FILE_TYPE', message: 'Selfie must be JPEG, PNG or WebP' } })
    }

    const buffer = await data.toBuffer()

    // Find or create guest profile
    let guest = guestSessionToken
      ? await prisma.guestProfile.findUnique({ where: { sessionToken: guestSessionToken } })
      : null

    if (!guest) {
      guest = await prisma.guestProfile.create({
        data: { eventId, sessionToken: generateToken(32) },
      })
    }

    // Store selfie
    const filename = `${generateToken(16)}.jpg`
    const selfieKey = buildSelfieKey(guest.id, filename)
    await storage.upload(selfieKey, buffer, mimeType)

    // Create selfie record
    const selfie = await prisma.guestSelfie.create({
      data: {
        guestProfileId: guest.id,
        storagePath: selfieKey,
        isProcessed: false,
      },
    })

    // Call AI service for face detection + embedding
    let embedding: number[] | null = null
    let qualityScore: number | null = null
    let aiError: string | null = null

    try {
      const FormData = (await import('form-data')).default
      const form = new FormData()
      form.append('file', buffer, { filename: 'selfie.jpg', contentType: mimeType })

      const aiResponse = await axios.post(
        `${env.AI_SERVICE_URL}/process-selfie`,
        form,
        { headers: form.getHeaders(), timeout: 30000 }
      )

      const { faces, quality_score } = aiResponse.data
      qualityScore = quality_score

      if (!faces || faces.length === 0) {
        return reply.code(422).send({ success: false, error: { code: 'NO_FACE_DETECTED', message: 'No face detected in the selfie. Please try again with a clearer photo.' } })
      }

      if (faces.length > 1) {
        return reply.code(422).send({ success: false, error: { code: 'MULTIPLE_FACES', message: 'Multiple faces detected. Please take a selfie with only your face.' } })
      }

      embedding = faces[0].embedding
    } catch (err: any) {
      aiError = err?.message ?? 'AI service error'
    }

    // Update selfie with embedding
    await prisma.guestSelfie.update({
      where: { id: selfie.id },
      data: {
        isProcessed: !aiError,
        processingError: aiError,
        qualityScore,
        ...(embedding ? { embedding: embedding as any } : {}),
      },
    })

    if (aiError || !embedding) {
      return reply.code(503).send({ success: false, error: { code: 'AI_SERVICE_ERROR', message: 'Face processing temporarily unavailable. Please try again.' } })
    }

    // Search pgvector index for matching faces in this event
    const threshold = env.FACE_MATCH_THRESHOLD
    const maxResults = env.MAX_FACE_SEARCH_RESULTS

    const embeddingStr = `[${embedding.join(',')}]`
    const scopeCondition = groupId
      ? `pf.event_id = '${eventId}' AND p.group_id = '${groupId}'`
      : `pf.event_id = '${eventId}'`

    const matchingFaces = await prisma.$queryRawUnsafe<Array<{
      photo_id: string
      face_id: string
      similarity: number
    }>>(
      `SELECT pf.photo_id, pf.id as face_id,
              1 - (pf.embedding <=> '${embeddingStr}'::vector) as similarity
       FROM photo_faces pf
       JOIN photos p ON p.id = pf.photo_id
       WHERE ${scopeCondition}
         AND pf.embedding IS NOT NULL
         AND p.deleted_at IS NULL
         AND 1 - (pf.embedding <=> '${embeddingStr}'::vector) >= ${threshold}
       ORDER BY similarity DESC
       LIMIT ${maxResults}`
    )

    // Get unique photos
    const photoIds = [...new Set(matchingFaces.map(f => f.photo_id))]

    // Update analytics
    await prisma.eventAnalytics.upsert({
      where: { eventId },
      create: { eventId, totalSearches: 1, successfulSearches: photoIds.length > 0 ? 1 : 0 },
      update: {
        totalSearches: { increment: 1 },
        successfulSearches: { increment: photoIds.length > 0 ? 1 : 0 },
      },
    })

    await prisma.guestProfile.update({
      where: { id: guest.id },
      data: { searchCount: { increment: 1 }, lastActiveAt: new Date() },
    })

    await auditService.log({
      userId: undefined,
      eventId,
      action: 'FACE_SEARCH',
      ipAddress: request.ip,
      metadata: { guestId: guest.id, matchCount: photoIds.length },
    })

    return reply.send({
      success: true,
      data: {
        guestSessionToken: guest.sessionToken,
        matchCount: photoIds.length,
        photoIds,
        selfieId: selfie.id,
      },
    })
  })

  // GET /api/v1/faces/guest-photos — fetch photos for a guest session
  app.get('/guest-photos', async (request, reply) => {
    const query = request.query as { token: string; eventId: string; page?: string; limit?: string }
    if (!query.token || !query.eventId) {
      return reply.code(400).send({ success: false, error: { code: 'MISSING_PARAMS', message: 'token and eventId required' } })
    }

    const guest = await prisma.guestProfile.findFirst({
      where: { sessionToken: query.token, eventId: query.eventId },
    })
    if (!guest) return reply.code(404).send({ success: false, error: { code: 'GUEST_NOT_FOUND', message: 'Session not found' } })

    const page = parseInt(query.page ?? '1', 10)
    const limit = Math.min(50, parseInt(query.limit ?? '20', 10))
    const skip = (page - 1) * limit

    // Get matched photo IDs from selfie embeddings
    const selfies = await prisma.guestSelfie.findMany({
      where: { guestProfileId: guest.id, isProcessed: true },
      select: { embedding: true },
    })

    if (selfies.length === 0) {
      return reply.send({ success: true, data: [], pagination: { total: 0, page, limit, totalPages: 0, hasNext: false, hasPrev: false } })
    }

    // Use best embedding (last selfie)
    const lastSelfie = selfies[selfies.length - 1]
    if (!lastSelfie.embedding) {
      return reply.send({ success: true, data: [], pagination: { total: 0, page, limit, totalPages: 0, hasNext: false, hasPrev: false } })
    }

    const threshold = env.FACE_MATCH_THRESHOLD
    const embeddingStr = JSON.stringify(lastSelfie.embedding)

    const matched = await prisma.$queryRawUnsafe<Array<{ photo_id: string }>>(
      `SELECT DISTINCT pf.photo_id
       FROM photo_faces pf
       JOIN photos p ON p.id = pf.photo_id
       WHERE pf.event_id = '${query.eventId}'
         AND pf.embedding IS NOT NULL
         AND p.deleted_at IS NULL
         AND 1 - (pf.embedding <=> '${embeddingStr}'::vector) >= ${threshold}
       LIMIT 1000`
    )

    const photoIds = matched.map(r => r.photo_id)
    const total = photoIds.length

    const photos = await prisma.photo.findMany({
      where: { id: { in: photoIds.slice(skip, skip + limit) }, deletedAt: null },
      select: {
        id: true, thumbnailPath: true, previewPath: true, storagePath: true,
        originalName: true, width: true, height: true, createdAt: true,
        group: { select: { id: true, name: true } },
        _count: { select: { favorites: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Attach signed URLs
    const photosWithUrls = await Promise.all(
      photos.map(async (p) => ({
        ...p,
        thumbnailUrl: p.thumbnailPath ? await storage.getSignedUrl(p.thumbnailPath, 3600) : null,
        previewUrl: p.previewPath ? await storage.getSignedUrl(p.previewPath, 3600) : null,
      }))
    )

    return reply.send({
      success: true,
      data: photosWithUrls,
      pagination: {
        total, page, limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    })
  })

  // POST /api/v1/faces/assign — admin manually assigns face to guest
  app.post('/assign', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as { sub: string }
    const body = request.body as { faceId: string; guestProfileId: string | null }

    await prisma.photoFace.update({
      where: { id: body.faceId },
      data: {
        guestProfileId: body.guestProfileId,
        isManuallyAssigned: true,
      },
    })

    await auditService.log({ userId: user.sub, action: 'ASSIGN_FACE', resourceType: 'face', resourceId: body.faceId, ipAddress: request.ip })
    return reply.send({ success: true })
  })

  // DELETE /api/v1/faces/:faceId — admin removes face detection
  app.delete('/:faceId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { faceId } = request.params as { faceId: string }
    const user = request.user as { sub: string }
    await prisma.photoFace.delete({ where: { id: faceId } })
    await auditService.log({ userId: user.sub, action: 'REMOVE_FACE', resourceType: 'face', resourceId: faceId, ipAddress: request.ip })
    return reply.send({ success: true })
  })
}