import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../config/database'

export const favoriteRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/v1/favorites/toggle
  app.post('/toggle', async (request, reply) => {
    const body = request.body as { photoId: string; guestSessionToken?: string; userId?: string }

    if (!body.photoId) return reply.code(400).send({ success: false, error: { code: 'MISSING_PHOTO_ID', message: 'photoId required' } })

    let guestId: string | null = null
    if (body.guestSessionToken) {
      const guest = await prisma.guestProfile.findUnique({ where: { sessionToken: body.guestSessionToken } })
      guestId = guest?.id ?? null
    }

    const userId = body.userId ?? null

    // Check existing
    const existing = await prisma.favorite.findFirst({
      where: {
        photoId: body.photoId,
        ...(guestId ? { guestProfileId: guestId } : {}),
        ...(userId ? { userId } : {}),
      },
    })

    if (existing) {
      await prisma.favorite.delete({ where: { id: existing.id } })
      await prisma.photo.update({ where: { id: body.photoId }, data: { favoriteCount: { decrement: 1 } } })
      return reply.send({ success: true, favorited: false })
    }

    await prisma.favorite.create({
      data: {
        photoId: body.photoId,
        guestProfileId: guestId,
        userId,
      },
    })
    await prisma.photo.update({ where: { id: body.photoId }, data: { favoriteCount: { increment: 1 } } })

    // Update analytics
    const photo = await prisma.photo.findUnique({ where: { id: body.photoId }, select: { eventId: true } })
    if (photo) {
      await prisma.eventAnalytics.upsert({
        where: { eventId: photo.eventId },
        create: { eventId: photo.eventId, totalFavorites: 1 },
        update: { totalFavorites: { increment: 1 } },
      })
    }

    return reply.send({ success: true, favorited: true })
  })

  // GET /api/v1/favorites/check/:photoId
  app.get('/check/:photoId', async (request, reply) => {
    const { photoId } = request.params as { photoId: string }
    const query = request.query as { token?: string }

    if (!query.token) return reply.send({ success: true, favorited: false })

    const guest = await prisma.guestProfile.findUnique({ where: { sessionToken: query.token } })
    if (!guest) return reply.send({ success: true, favorited: false })

    const fav = await prisma.favorite.findFirst({ where: { photoId, guestProfileId: guest.id } })
    return reply.send({ success: true, favorited: !!fav })
  })
}