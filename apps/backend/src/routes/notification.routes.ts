import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../config/database'
import { requirePhotographer } from '../middleware/auth.middleware'

export const notificationRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as { sub: string }
    const notifications = await prisma.notification.findMany({
      where: { userId: user.sub },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return reply.send({ success: true, data: notifications })
  })

  app.post('/mark-read', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as { sub: string }
    const body = request.body as { ids?: string[] }

    const where: any = { userId: user.sub }
    if (body?.ids?.length) where.id = { in: body.ids }

    await prisma.notification.updateMany({ where, data: { isRead: true } })
    return reply.send({ success: true })
  })
}