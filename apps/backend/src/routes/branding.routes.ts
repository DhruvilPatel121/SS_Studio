import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../config/database'
import { requirePhotographer } from '../middleware/auth.middleware'

export const brandingRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/v1/branding
  app.get('/', { preHandler: [app.authenticate, requirePhotographer()] }, async (request, reply) => {
    const user = request.user as { sub: string }
    const branding = await prisma.brandingSettings.findUnique({ where: { userId: user.sub } })
    return reply.send({ success: true, data: branding })
  })

  // PATCH /api/v1/branding
  app.patch('/', { preHandler: [app.authenticate, requirePhotographer()] }, async (request, reply) => {
    const user = request.user as { sub: string }
    const body = request.body as Record<string, unknown>

    const branding = await prisma.brandingSettings.upsert({
      where: { userId: user.sub },
      create: { userId: user.sub, ...body } as any,
      update: body as any,
    })

    return reply.send({ success: true, data: branding })
  })

  // GET /api/v1/branding/public/:userId — used by guest pages
  app.get('/public/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string }
    const branding = await prisma.brandingSettings.findUnique({
      where: { userId },
      select: {
        studioName: true, logoUrl: true, faviconUrl: true,
        primaryColor: true, secondaryColor: true, backgroundColor: true,
        buttonStyle: true, footerText: true,
        watermarkType: true, watermarkPosition: true,
      },
    })
    return reply.send({ success: true, data: branding })
  })
}