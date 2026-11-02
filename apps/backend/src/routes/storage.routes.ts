import { FastifyInstance } from 'fastify'
import path from 'path'
import { createReadStream, existsSync } from 'fs'
import { requirePhotographer } from '../middleware/auth.middleware'
import { storage, LocalStorageProvider } from '../services/storage.service'
import { env } from '../config/env'

export async function storageRoutes(app: FastifyInstance) {
  // Serve local storage files (dev only)
  app.get('/storage/serve/:key', {
    preHandler: [requirePhotographer()],
  }, async (request, reply) => {
    if (env.STORAGE_PROVIDER !== 'local') {
      return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Not using local storage' } })
    }

    const { key } = request.params as { key: string }
    const decoded = decodeURIComponent(key)
    // Prevent path traversal
    const safePath = path.normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, '')
    const fullPath = path.join(env.STORAGE_LOCAL_PATH, safePath)

    if (!existsSync(fullPath)) {
      return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'File not found' } })
    }

    const ext = path.extname(fullPath).toLowerCase()
    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.png': 'image/png', '.webp': 'image/webp',
      '.heic': 'image/heic', '.zip': 'application/zip',
    }
    const contentType = mimeMap[ext] ?? 'application/octet-stream'

    reply.header('Content-Type', contentType)
    reply.header('Cache-Control', 'public, max-age=86400')
    return reply.send(createReadStream(fullPath))
  })
}