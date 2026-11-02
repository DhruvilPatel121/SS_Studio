import { PrismaClient } from '@prisma/client'
import { logger } from './logger'

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

export const prisma: PrismaClient =
  global.__prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma
}

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect()
    logger.info('✅ Database connected')
  } catch (err) {
    logger.error('❌ Database connection failed', err)
    throw err
  }
}