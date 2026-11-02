import type { FastifyPluginAsync } from 'fastify'
import QRCode from 'qrcode'
import { prisma } from '../config/database'
import { generateToken } from '../utils/helpers'
import { env } from '../config/env'
import { notFound } from '../utils/errors'
import { auditService } from '../services/audit.service'

export const qrRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/v1/qr/generate
  app.post('/generate', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as { sub: string }
    const body = request.body as { eventId: string; groupId?: string }

    if (!body.eventId) return reply.code(400).send({ success: false, error: { code: 'MISSING_EVENT_ID', message: 'eventId required' } })

    const token = generateToken(24)
    const url = body.groupId
      ? `${env.APP_URL}/e/${body.eventId}/group/${body.groupId}?qr=${token}`
      : `${env.APP_URL}/e/${body.eventId}?qr=${token}`

    // Generate SVG and PNG
    const svgData = await QRCode.toString(url, { type: 'svg', width: 300, margin: 2 })
    const pngBuffer = await QRCode.toBuffer(url, { type: 'png', width: 512, margin: 2 })

    // Store PNG in storage
    const { storage } = await import('../services/storage.service')
    const pngKey = `qrcodes/${body.eventId}/${token}.png`
    await storage.upload(pngKey, pngBuffer, 'image/png')

    const qr = await prisma.qrCode.create({
      data: {
        eventId: body.eventId,
        groupId: body.groupId ?? null,
        token,
        url,
        svgData,
        pngPath: pngKey,
      },
    })

    await auditService.log({
      userId: user.sub, eventId: body.eventId, action: 'GENERATE_QR',
      resourceType: 'qr', resourceId: qr.id, ipAddress: request.ip,
    })

    return reply.send({
      success: true,
      data: {
        ...qr,
        svgData,
        pngUrl: await storage.getSignedUrl(pngKey, 86400),
      },
    })
  })

  // GET /api/v1/qr/:eventId — list QR codes for event
  app.get('/:eventId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { eventId } = request.params as { eventId: string }
    const qrCodes = await prisma.qrCode.findMany({
      where: { eventId },
      orderBy: { createdAt: 'desc' },
      include: { group: { select: { id: true, name: true } } },
    })
    return reply.send({ success: true, data: qrCodes })
  })

  // GET /api/v1/qr/scan/:token — record scan and redirect
  app.get('/scan/:token', async (request, reply) => {
    const { token } = request.params as { token: string }
    const qr = await prisma.qrCode.findUnique({ where: { token } })
    if (!qr) return reply.code(404).send({ success: false, error: { code: 'QR_NOT_FOUND', message: 'QR code not found' } })

    await prisma.qrCode.update({
      where: { id: qr.id },
      data: { scanCount: { increment: 1 } },
    })

    return reply.redirect(qr.url)
  })

  // DELETE /api/v1/qr/:qrId
  app.delete('/:qrId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { qrId } = request.params as { qrId: string }
    await prisma.qrCode.delete({ where: { id: qrId } })
    return reply.send({ success: true })
  })
}