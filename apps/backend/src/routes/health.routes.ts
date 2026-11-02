import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../config/database'
import { redis } from '../config/redis'
import { env } from '../config/env'
import axios from 'axios'

export const healthRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/health — quick liveness
  app.get('/health', async (_request, reply) => {
    return reply.send({ status: 'ok', timestamp: new Date().toISOString() })
  })

  // GET /api/health/detailed — full system health
  app.get('/health/detailed', async (_request, reply) => {
    const checks = await Promise.allSettled([
      // Database
      prisma.$queryRaw`SELECT 1`.then(() => ({ name: 'database', status: 'ONLINE' })),
      // Redis
      redis.ping().then(() => ({ name: 'redis', status: 'ONLINE' })),
      // AI Service
      axios.get(`${env.AI_SERVICE_URL}/health`, { timeout: 5000 })
        .then(() => ({ name: 'ai_service', status: 'ONLINE' })),
      // Storage (MinIO ping)
      env.STORAGE_PROVIDER === 'minio'
        ? axios.get(`${env.MINIO_ENDPOINT}/minio/health/live`, { timeout: 5000 })
            .then(() => ({ name: 'storage', status: 'ONLINE' }))
        : Promise.resolve({ name: 'storage', status: 'ONLINE' }),
    ])

    const results = checks.map((c, i) => {
      const names = ['database', 'redis', 'ai_service', 'storage']
      if (c.status === 'fulfilled') return c.value
      return { name: names[i], status: 'OFFLINE', error: (c.reason as Error)?.message }
    })

    const allOnline = results.every(r => r.status === 'ONLINE')
    const httpStatus = allOnline ? 200 : 503

    return reply.code(httpStatus).send({
      status: allOnline ? 'healthy' : 'degraded',
      services: results,
      timestamp: new Date().toISOString(),
    })
  })
}