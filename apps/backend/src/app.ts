import Fastify, { FastifyInstance } from 'fastify'
import fastifyCors from '@fastify/cors'
import fastifyHelmet from '@fastify/helmet'
import fastifyJwt from '@fastify/jwt'
import fastifyCookie from '@fastify/cookie'
import fastifyMultipart from '@fastify/multipart'
import fastifyRateLimit from '@fastify/rate-limit'
import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUi from '@fastify/swagger-ui'
import { env } from './config/env'
import { prisma } from './config/database'
import { redis } from './config/redis'
import { logger } from './config/logger'

// Routes
import { authRoutes } from './routes/auth.routes'
import { eventRoutes } from './routes/event.routes'
import { groupRoutes } from './routes/group.routes'
import { photoRoutes } from './routes/photo.routes'
import { uploadRoutes } from './routes/upload.routes'
import { guestRoutes } from './routes/guest.routes'
import { faceRoutes } from './routes/face.routes'
import { qrRoutes } from './routes/qr.routes'
import { downloadRoutes } from './routes/download.routes'
import { favoriteRoutes } from './routes/favorite.routes'
import { adminRoutes } from './routes/admin.routes'
import { superAdminRoutes } from './routes/super-admin.routes'
import { analyticsRoutes } from './routes/analytics.routes'
import { notificationRoutes } from './routes/notification.routes'
import { brandingRoutes } from './routes/branding.routes'
import { healthRoutes } from './routes/health.routes'
import { teamRoutes } from './routes/team.routes'
import { settingsRoutes } from './routes/settings.routes'
import { storageRoutes } from './routes/storage.routes'

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false, // use pino directly
    trustProxy: true,
  })

  // Security
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: false, // configured at nginx level
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })

  await app.register(fastifyCors, {
    origin: env.APP_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })

  // Rate limiting
  await app.register(fastifyRateLimit, {
    max: 300,
    timeWindow: '1 minute',
    redis,
    keyGenerator: (req) => req.ip,
    errorResponseBuilder: () => ({
      success: false,
      error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please slow down.' },
    }),
  })

  // Auth
  await app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    cookie: { cookieName: 'auth_token', signed: false },
  })

  await app.register(fastifyCookie, {
    secret: env.SESSION_SECRET,
  })

  // Multipart (file uploads)
  await app.register(fastifyMultipart, {
    limits: {
      fileSize: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024,
      files: 50,
    },
  })

  // Swagger docs
  await app.register(fastifySwagger, {
    openapi: {
      info: { title: 'Medo.dev API', description: 'AI Photo Sharing Platform', version: '1.0.0' },
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  })

  await app.register(fastifySwaggerUi, {
    routePrefix: '/documentation',
    uiConfig: { deepLinking: true },
  })

  // Decorate with prisma & redis
  app.decorate('prisma', prisma)
  app.decorate('redis', redis)

  // Auth decorator
  app.decorate('authenticate', async function (request: any, reply: any) {
    try {
      await request.jwtVerify()
    } catch {
      reply.code(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } })
    }
  })

  // Global error handler
  app.setErrorHandler((error, _request, reply) => {
    logger.error(error)

    if (error.validation) {
      return reply.code(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request data', details: error.validation },
      })
    }

    if (error.statusCode) {
      return reply.code(error.statusCode).send({
        success: false,
        error: { code: 'REQUEST_ERROR', message: error.message },
      })
    }

    return reply.code(500).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    })
  })

  // 404 handler
  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    })
  })

  // Register routes
  const apiPrefix = '/api/v1'
  await app.register(healthRoutes, { prefix: '/api' })
  await app.register(authRoutes, { prefix: `${apiPrefix}/auth` })
  await app.register(eventRoutes, { prefix: `${apiPrefix}/events` })
  await app.register(groupRoutes, { prefix: `${apiPrefix}/events` })
  await app.register(photoRoutes, { prefix: `${apiPrefix}/photos` })
  await app.register(uploadRoutes, { prefix: `${apiPrefix}/upload` })
  await app.register(guestRoutes, { prefix: `${apiPrefix}/guests` })
  await app.register(faceRoutes, { prefix: `${apiPrefix}/faces` })
  await app.register(qrRoutes, { prefix: `${apiPrefix}/qr` })
  await app.register(downloadRoutes, { prefix: `${apiPrefix}/downloads` })
  await app.register(favoriteRoutes, { prefix: `${apiPrefix}/favorites` })
  await app.register(adminRoutes, { prefix: `${apiPrefix}/admin` })
  await app.register(superAdminRoutes, { prefix: `${apiPrefix}/super-admin` })
  await app.register(analyticsRoutes, { prefix: `${apiPrefix}/analytics` })
  await app.register(notificationRoutes, { prefix: `${apiPrefix}/notifications` })
  await app.register(brandingRoutes, { prefix: `${apiPrefix}/branding` })
  await app.register(teamRoutes, { prefix: `${apiPrefix}/teams` })
  await app.register(settingsRoutes, { prefix: `${apiPrefix}/settings` })
  await app.register(storageRoutes, { prefix: `${apiPrefix}` })

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down gracefully...')
    await app.close()
    await prisma.$disconnect()
    redis.disconnect()
    process.exit(0)
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)

  return app
}