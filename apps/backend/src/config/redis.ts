import IORedis from 'ioredis'
import { env } from './env'
import { logger } from './logger'

export const redis = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // required by BullMQ
  enableReadyCheck: false,
  lazyConnect: true,
})

redis.on('connect', () => logger.info('✅ Redis connected'))
redis.on('error', (err) => logger.error('Redis error:', err))

export async function connectRedis(): Promise<void> {
  await redis.connect()
}