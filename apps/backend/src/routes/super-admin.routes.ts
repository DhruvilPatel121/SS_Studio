import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../config/database'
import { requireSuperAdmin } from '../middleware/auth.middleware'
import { parsePagination, buildPaginatedResponse } from '../utils/helpers'
import { redis } from '../config/redis'
import { env } from '../config/env'
import axios from 'axios'

export const superAdminRoutes: FastifyPluginAsync = async (app) => {
  // All routes require SUPER_ADMIN
  app.addHook('preHandler', requireSuperAdmin())

  // GET /api/v1/super-admin/stats
  app.get('/stats', async (_request, reply) => {
    const [users, photographers, events, photos, faces, processingJobs, activeSessions] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'PHOTOGRAPHER' } }),
      prisma.event.count({ where: { deletedAt: null } }),
      prisma.photo.count({ where: { deletedAt: null } }),
      prisma.photoFace.count(),
      prisma.processingJob.groupBy({ by: ['status'], _count: true }),
      prisma.session.count({ where: { expiresAt: { gt: new Date() } } }),
    ])

    return reply.send({ success: true, data: { users, photographers, events, photos, faces, processingJobs, activeSessions } })
  })

  // GET /api/v1/super-admin/users
  app.get('/users', async (request, reply) => {
    const query = request.query as { page?: string; limit?: string; role?: string; search?: string }
    const { page, limit, skip } = parsePagination(query)
    const where: any = {}
    if (query.role) where.role = query.role
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ]
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, email: true, name: true, role: true, isActive: true,
          createdAt: true, lastLoginAt: true,
          _count: { select: { ownedEvents: true } },
        },
      }),
      prisma.user.count({ where }),
    ])

    return reply.send({ success: true, ...buildPaginatedResponse(users, total, page, limit) })
  })

  // PATCH /api/v1/super-admin/users/:userId
  app.patch('/users/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string }
    const body = request.body as { isActive?: boolean; role?: string; name?: string }

    const user = await prisma.user.update({
      where: { id: userId },
      data: body,
      select: { id: true, email: true, name: true, role: true, isActive: true },
    })

    return reply.send({ success: true, data: user })
  })

  // DELETE /api/v1/super-admin/users/:userId
  app.delete('/users/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string }
    await prisma.user.delete({ where: { id: userId } })
    return reply.send({ success: true })
  })

  // GET /api/v1/super-admin/events
  app.get('/events', async (request, reply) => {
    const query = request.query as { page?: string; limit?: string; status?: string; search?: string }
    const { page, limit, skip } = parsePagination(query)
    const where: any = { deletedAt: null }
    if (query.status) where.status = query.status
    if (query.search) where.name = { contains: query.search, mode: 'insensitive' }

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          analytics: true,
          _count: { select: { photos: true, groups: true, guestProfiles: true } },
        },
      }),
      prisma.event.count({ where }),
    ])

    return reply.send({ success: true, ...buildPaginatedResponse(events, total, page, limit) })
  })

  // GET /api/v1/super-admin/audit-logs
  app.get('/audit-logs', async (request, reply) => {
    const query = request.query as { page?: string; limit?: string; action?: string; userId?: string }
    const { page, limit, skip } = parsePagination(query)
    const where: any = {}
    if (query.action) where.action = query.action
    if (query.userId) where.userId = query.userId

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.auditLog.count({ where }),
    ])

    return reply.send({ success: true, ...buildPaginatedResponse(logs, total, page, limit) })
  })

  // GET /api/v1/super-admin/jobs
  app.get('/jobs', async (request, reply) => {
    const query = request.query as { page?: string; limit?: string; status?: string; type?: string }
    const { page, limit, skip } = parsePagination(query)
    const where: any = {}
    if (query.status) where.status = query.status
    if (query.type) where.type = query.type

    const [jobs, total] = await Promise.all([
      prisma.processingJob.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
      }),
      prisma.processingJob.count({ where }),
    ])

    return reply.send({ success: true, ...buildPaginatedResponse(jobs, total, page, limit) })
  })

  // POST /api/v1/super-admin/jobs/:jobId/retry
  app.post('/jobs/:jobId/retry', async (request, reply) => {
    const { jobId } = request.params as { jobId: string }
    const job = await prisma.processingJob.findUnique({ where: { id: jobId } })
    if (!job) return reply.code(404).send({ success: false, error: { code: 'JOB_NOT_FOUND', message: 'Job not found' } })

    const { photoQueue } = await import('../workers/queues')
    await photoQueue.add(job.type as any, { ...(job.metadata as object), jobId: job.id }, { attempts: 3 })
    await prisma.processingJob.update({ where: { id: jobId }, data: { status: 'PENDING', error: null } })

    return reply.send({ success: true })
  })

  // GET /api/v1/super-admin/settings
  app.get('/settings', async (_request, reply) => {
    const settings = await prisma.systemSettings.findUnique({ where: { id: 'global' } })
    return reply.send({ success: true, data: settings })
  })

  // PATCH /api/v1/super-admin/settings
  app.patch('/settings', async (request, reply) => {
    const body = request.body as Record<string, unknown>
    const settings = await prisma.systemSettings.upsert({
      where: { id: 'global' },
      create: { id: 'global', ...body } as any,
      update: body as any,
    })
    return reply.send({ success: true, data: settings })
  })
}