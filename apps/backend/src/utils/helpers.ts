import crypto from 'crypto'
import { nanoid } from 'nanoid'

export function generateSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

export function generateToken(length = 32): string {
  return nanoid(length)
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
}

export function generateUniqueSlug(base: string): string {
  const slug = generateSlug(base)
  const suffix = nanoid(6).toLowerCase()
  return `${slug}-${suffix}`
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 255)
}

export function parsePagination(query: { page?: unknown; limit?: unknown }) {
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? '20'), 10) || 20))
  const skip = (page - 1) * limit
  return { page, limit, skip }
}

export function buildPaginatedResponse<T>(data: T[], total: number, page: number, limit: number) {
  return {
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  }
}