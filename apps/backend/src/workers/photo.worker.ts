import { Worker, Job } from 'bullmq'
import sharp from 'sharp'
import axios from 'axios'
import archiver from 'archiver'
import { createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'
import { redis } from '../config/redis'
import { prisma } from '../config/database'
import { storage, buildStorageKey } from '../services/storage.service'
import { env } from '../config/env'
import { logger } from '../config/logger'
import { generateToken } from '../utils/helpers'
import path from 'path'

async function processThumbnail(job: Job) {
  const { photoId, eventId } = job.data
  logger.info(`[Worker] Generating thumbnail for photo ${photoId}`)

  await prisma.processingJob.create({
    data: { photoId, eventId, type: 'PHOTO_THUMBNAIL', status: 'ACTIVE', bullJobId: String(job.id) },
  })

  try {
    const photo = await prisma.photo.findUnique({ where: { id: photoId } })
    if (!photo || photo.deletedAt) return

    // Download original from storage
    const signedUrl = await storage.getSignedUrl(photo.storagePath, 300)
    const response = await axios.get(signedUrl, { responseType: 'arraybuffer', timeout: 60000 })
    const buffer = Buffer.from(response.data)

    // Generate thumbnail (400px wide, maintain aspect)
    const thumbBuffer = await sharp(buffer)
      .rotate() // auto-rotate from EXIF
      .resize({ width: 400, height: 400, fit: 'cover', position: 'attention' })
      .webp({ quality: 80 })
      .toBuffer()

    // Generate preview (1200px wide)
    const previewBuffer = await sharp(buffer)
      .rotate()
      .resize({ width: 1200, withoutEnlargement: true })
      .jpeg({ quality: 85, progressive: true })
      .toBuffer()

    const thumbKey = buildStorageKey(eventId, 'thumbnails', `${photoId}.webp`)
    const previewKey = buildStorageKey(eventId, 'previews', `${photoId}.jpg`)

    await Promise.all([
      storage.upload(thumbKey, thumbBuffer, 'image/webp'),
      storage.upload(previewKey, previewBuffer, 'image/jpeg'),
    ])

    await prisma.photo.update({
      where: { id: photoId },
      data: { thumbnailPath: thumbKey, previewPath: previewKey, status: 'PROCESSING' },
    })

    await prisma.processingJob.updateMany({
      where: { photoId, type: 'PHOTO_THUMBNAIL' },
      data: { status: 'COMPLETED', completedAt: new Date(), progress: 100 },
    })

    // Queue face detection
    const { photoQueue } = await import('./queues')
    await photoQueue.add('FACE_DETECTION', { photoId, eventId }, { attempts: 3 })

    logger.info(`[Worker] Thumbnail done for ${photoId}`)
  } catch (err: any) {
    logger.error(`[Worker] Thumbnail failed for ${photoId}: ${err.message}`)
    await prisma.photo.update({ where: { id: photoId }, data: { status: 'FAILED', processingError: err.message } })
    await prisma.processingJob.updateMany({
      where: { photoId, type: 'PHOTO_THUMBNAIL' },
      data: { status: 'FAILED', error: err.message },
    })
    throw err
  }
}

async function processFaceDetection(job: Job) {
  const { photoId, eventId } = job.data
  logger.info(`[Worker] Face detection for photo ${photoId}`)

  const photo = await prisma.photo.findUnique({ where: { id: photoId } })
  if (!photo || photo.deletedAt) return

  try {
    // Download preview for face detection (faster than original)
    const keyToUse = photo.previewPath ?? photo.storagePath
    const signedUrl = await storage.getSignedUrl(keyToUse, 300)
    const response = await axios.get(signedUrl, { responseType: 'arraybuffer', timeout: 60000 })
    const buffer = Buffer.from(response.data)

    // Call AI service
    const FormData = (await import('form-data')).default
    const form = new FormData()
    form.append('file', buffer, { filename: 'photo.jpg', contentType: photo.mimeType })
    form.append('event_id', eventId)

    const aiResponse = await axios.post(
      `${env.AI_SERVICE_URL}/process-photo`,
      form,
      { headers: form.getHeaders(), timeout: 120000 }
    )

    const { faces } = aiResponse.data

    // Store each detected face
    if (faces && faces.length > 0) {
      await prisma.$transaction(
        faces.map((face: any) =>
          prisma.photoFace.create({
            data: {
              photoId,
              eventId,
              bboxX: face.bbox[0],
              bboxY: face.bbox[1],
              bboxW: face.bbox[2],
              bboxH: face.bbox[3],
              detectionConf: face.confidence,
              qualityScore: face.quality_score,
              isBlurry: face.is_blurry ?? false,
              isDark: face.is_dark ?? false,
              embedding: face.embedding as any,
            },
          })
        )
      )
    }

    await prisma.photo.update({
      where: { id: photoId },
      data: { status: 'PROCESSED', faceCount: faces?.length ?? 0 },
    })

    // Update event analytics
    await prisma.eventAnalytics.upsert({
      where: { eventId },
      create: { eventId, processedPhotos: 1, totalFaces: faces?.length ?? 0 },
      update: {
        processedPhotos: { increment: 1 },
        totalFaces: { increment: faces?.length ?? 0 },
      },
    })

    // Notify owner
    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { ownerId: true } })
    if (event) {
      // Only batch-notify, not per-photo (handled by bulk job completion)
    }

    logger.info(`[Worker] Face detection done for ${photoId}: ${faces?.length ?? 0} faces`)
  } catch (err: any) {
    logger.error(`[Worker] Face detection failed for ${photoId}: ${err.message}`)
    await prisma.photo.update({ where: { id: photoId }, data: { status: 'FAILED', processingError: err.message } })
    throw err
  }
}

async function generateZip(job: Job) {
  const { photoIds, eventId, guestSessionToken } = job.data
  logger.info(`[Worker] Generating ZIP for ${photoIds.length} photos, event ${eventId}`)

  const dbJob = await prisma.processingJob.findFirst({
    where: { bullJobId: String(job.id), type: 'ZIP_GENERATION' },
  })

  try {
    const photos = await prisma.photo.findMany({
      where: { id: { in: photoIds }, deletedAt: null },
      select: { id: true, storagePath: true, originalName: true },
    })

    const zipKey = `zips/${eventId}/${generateToken(16)}.zip`
    const tempPath = `/tmp/${generateToken(16)}.zip`

    // Create zip archive
    const output = createWriteStream(tempPath)
    const archive = archiver('zip', { zlib: { level: 6 } })

    archive.pipe(output)

    let processed = 0
    for (const photo of photos) {
      try {
        const signedUrl = await storage.getSignedUrl(photo.storagePath, 600)
        const res = await axios.get(signedUrl, { responseType: 'arraybuffer', timeout: 30000 })
        archive.append(Buffer.from(res.data), { name: photo.originalName })
        processed++
        if (dbJob) {
          await prisma.processingJob.update({
            where: { id: dbJob.id },
            data: { progress: Math.round((processed / photos.length) * 90) },
          })
        }
      } catch {
        // Skip failed photos
      }
    }

    await archive.finalize()
    await new Promise((res, rej) => { output.on('close', res); output.on('error', rej) })

    // Upload zip to storage
    const { readFile } = await import('fs/promises')
    const zipBuffer = await readFile(tempPath)
    await storage.upload(zipKey, zipBuffer, 'application/zip')

    // Cleanup temp file
    const { unlink } = await import('fs/promises')
    await unlink(tempPath).catch(() => {})

    if (dbJob) {
      await prisma.processingJob.update({
        where: { id: dbJob.id },
        data: {
          status: 'COMPLETED',
          progress: 100,
          completedAt: new Date(),
          metadata: { zipKey, photoCount: photos.length },
        },
      })
    }

    logger.info(`[Worker] ZIP generated: ${zipKey}`)
  } catch (err: any) {
    logger.error(`[Worker] ZIP generation failed: ${err.message}`)
    if (dbJob) {
      await prisma.processingJob.update({
        where: { id: dbJob.id },
        data: { status: 'FAILED', error: err.message },
      })
    }
    throw err
  }
}

// ─── Start / Stop Workers ─────────────────────────────────────────────────────

let workerInstance: Worker | null = null

export async function startWorkers(): Promise<void> {
  workerInstance = new Worker(
    'photo-processing',
    async (job: Job) => {
      switch (job.name) {
        case 'PHOTO_THUMBNAIL': return processThumbnail(job)
        case 'FACE_DETECTION': return processFaceDetection(job)
        case 'ZIP_GENERATION': return generateZip(job)
        default: logger.warn(`Unknown job type: ${job.name}`)
      }
    },
    { connection: redis, concurrency: 4 }
  )

  workerInstance.on('completed', (job) => logger.info(`✅ Job completed: ${job.name} ${job.id}`))
  workerInstance.on('failed', (job, err) => logger.error(`❌ Job failed: ${job?.name} ${job?.id}: ${err.message}`))
  logger.info('🔄 BullMQ workers started')
}

export async function stopWorkers(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close()
    workerInstance = null
    logger.info('🛑 BullMQ workers stopped')
  }
}