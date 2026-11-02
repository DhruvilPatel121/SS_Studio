import { createReadStream, createWriteStream } from 'fs'
import { mkdir, unlink, access } from 'fs/promises'
import path from 'path'
import { env } from '../config/env'
import { logger } from '../config/logger'
import * as Minio from 'minio'

// ─── Storage Provider Interface ──────────────────────────────────────────────

export interface StorageProvider {
  upload(key: string, buffer: Buffer, mimeType: string): Promise<string>
  getSignedUrl(key: string, expirySeconds?: number): Promise<string>
  delete(key: string): Promise<void>
  exists(key: string): Promise<boolean>
  getPublicUrl(key: string): string
}

// ─── Local Storage ────────────────────────────────────────────────────────────

class LocalStorageProvider implements StorageProvider {
  private basePath: string

  constructor(basePath: string) {
    this.basePath = path.resolve(basePath)
  }

  async upload(key: string, buffer: Buffer, _mimeType: string): Promise<string> {
    const fullPath = path.join(this.basePath, key)
    await mkdir(path.dirname(fullPath), { recursive: true })
    const { writeFile } = await import('fs/promises')
    await writeFile(fullPath, buffer)
    return key
  }

  async getSignedUrl(key: string, _expirySeconds = 3600): Promise<string> {
    // For local storage, return a proxy URL through the API
    return `/api/v1/storage/serve/${encodeURIComponent(key)}`
  }

  async delete(key: string): Promise<void> {
    const fullPath = path.join(this.basePath, key)
    try {
      await unlink(fullPath)
    } catch {
      logger.warn(`Could not delete local file: ${key}`)
    }
  }

  async exists(key: string): Promise<boolean> {
    const fullPath = path.join(this.basePath, key)
    try {
      await access(fullPath)
      return true
    } catch {
      return false
    }
  }

  getPublicUrl(key: string): string {
    return `/api/v1/storage/serve/${encodeURIComponent(key)}`
  }

  getFullPath(key: string): string {
    return path.join(this.basePath, key)
  }
}

// ─── MinIO Storage ────────────────────────────────────────────────────────────

class MinioStorageProvider implements StorageProvider {
  private client: Minio.Client
  private bucket: string

  constructor() {
    const endpointUrl = new URL(env.MINIO_ENDPOINT)
    this.client = new Minio.Client({
      endPoint: endpointUrl.hostname,
      port: parseInt(endpointUrl.port) || (env.MINIO_USE_SSL ? 443 : 9000),
      useSSL: env.MINIO_USE_SSL,
      accessKey: env.MINIO_ACCESS_KEY,
      secretKey: env.MINIO_SECRET_KEY,
    })
    this.bucket = env.MINIO_BUCKET
  }

  async ensureBucket(): Promise<void> {
    const exists = await this.client.bucketExists(this.bucket)
    if (!exists) {
      await this.client.makeBucket(this.bucket, 'us-east-1')
      logger.info(`✅ MinIO bucket created: ${this.bucket}`)
    }
  }

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<string> {
    await this.ensureBucket()
    await this.client.putObject(this.bucket, key, buffer, buffer.length, {
      'Content-Type': mimeType,
    })
    return key
  }

  async getSignedUrl(key: string, expirySeconds = 3600): Promise<string> {
    return this.client.presignedGetObject(this.bucket, key, expirySeconds)
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.removeObject(this.bucket, key)
    } catch {
      logger.warn(`Could not delete MinIO object: ${key}`)
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucket, key)
      return true
    } catch {
      return false
    }
  }

  getPublicUrl(key: string): string {
    return `${env.MINIO_ENDPOINT}/${this.bucket}/${key}`
  }
}

// ─── Storage Key Helpers ──────────────────────────────────────────────────────

export function buildStorageKey(eventId: string, type: 'originals' | 'thumbnails' | 'previews' | 'selfies', filename: string): string {
  return `events/${eventId}/${type}/${filename}`
}

export function buildSelfieKey(guestId: string, filename: string): string {
  return `selfies/${guestId}/${filename}`
}

// ─── Factory ──────────────────────────────────────────────────────────────────

function createStorageProvider(): StorageProvider {
  if (env.STORAGE_PROVIDER === 'local') {
    logger.info('📁 Using local storage provider')
    return new LocalStorageProvider(env.STORAGE_LOCAL_PATH)
  }
  logger.info('☁️  Using MinIO storage provider')
  return new MinioStorageProvider()
}

export const storage = createStorageProvider()
export { LocalStorageProvider, MinioStorageProvider }