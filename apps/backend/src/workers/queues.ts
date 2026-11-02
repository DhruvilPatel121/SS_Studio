import { Queue } from 'bullmq'
import { redis } from '../config/redis'

export const photoQueue = new Queue('photo-processing', {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
  },
})

export const zipQueue = new Queue('zip-generation', {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: { count: 20 },
    removeOnFail: { count: 100 },
    attempts: 2,
  },
})