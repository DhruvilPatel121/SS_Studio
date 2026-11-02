import { buildApp } from './app'
import { env } from './config/env'
import { logger } from './config/logger'
import { startWorkers, stopWorkers } from './workers/photo.worker'

async function main() {
  // Start BullMQ background workers
  await startWorkers()
  logger.info('⚙️  BullMQ workers started')

  const app = await buildApp()

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' })
    logger.info(`🚀 Medo Backend running on port ${env.PORT}`)
    logger.info(`📖 API docs: http://localhost:${env.PORT}/documentation`)
    logger.info(`🌍 Environment: ${env.NODE_ENV}`)
  } catch (err) {
    logger.error(err)
    process.exit(1)
  }
}

// Graceful worker shutdown on signal
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received — stopping workers')
  await stopWorkers()
})
process.on('SIGINT', async () => {
  logger.info('SIGINT received — stopping workers')
  await stopWorkers()
})

main()