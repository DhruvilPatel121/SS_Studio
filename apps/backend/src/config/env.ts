import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  APP_URL: z.string().default('http://localhost:3000'),

  DATABASE_URL: z.string(),
  REDIS_URL: z.string(),
  REDIS_PASSWORD: z.string().optional(),

  STORAGE_PROVIDER: z.enum(['local', 'minio']).default('minio'),
  STORAGE_LOCAL_PATH: z.string().default('./storage'),

  MINIO_ENDPOINT: z.string().default('http://localhost:9000'),
  MINIO_ACCESS_KEY: z.string(),
  MINIO_SECRET_KEY: z.string(),
  MINIO_BUCKET: z.string().default('medo-photos'),
  MINIO_USE_SSL: z.string().transform(v => v === 'true').default('false'),

  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  SESSION_SECRET: z.string().min(32),

  AI_SERVICE_URL: z.string().default('http://localhost:8000'),

  FACE_MATCH_THRESHOLD: z.coerce.number().default(0.45),
  FACE_QUALITY_THRESHOLD: z.coerce.number().default(0.5),
  FACE_MIN_SIZE: z.coerce.number().default(40),
  MAX_FACE_SEARCH_RESULTS: z.coerce.number().default(500),
  SELFIE_RATE_LIMIT_PER_MINUTE: z.coerce.number().default(10),

  MAX_UPLOAD_SIZE_MB: z.coerce.number().default(50),
  ALLOWED_IMAGE_TYPES: z.string().default('image/jpeg,image/png,image/webp,image/heic'),

  DEFAULT_TIMEZONE: z.string().default('Asia/Kolkata'),

  DEMO_EMAIL: z.string().email().optional(),
  DEMO_PASSWORD: z.string().optional(),
  SUPER_ADMIN_EMAIL: z.string().email().optional(),
  SUPER_ADMIN_PASSWORD: z.string().optional(),

  EMAIL_ADAPTER: z.enum(['console', 'smtp']).default('console'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().default('noreply@medo.dev'),
})

function loadEnv() {
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    console.error('❌ Invalid environment variables:')
    console.error(parsed.error.flatten().fieldErrors)
    process.exit(1)
  }
  return parsed.data
}

export const env = loadEnv()
export type Env = typeof env