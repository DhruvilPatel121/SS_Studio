export class AppError extends Error {
  code: string
  statusCode: number

  constructor(code: string, message: string, statusCode = 400) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.statusCode = statusCode
  }
}

export function notFound(resource: string): AppError {
  return new AppError(`${resource.toUpperCase()}_NOT_FOUND`, `${resource} not found`, 404)
}

export function forbidden(message = 'Access denied'): AppError {
  return new AppError('FORBIDDEN', message, 403)
}

export function unauthorized(message = 'Authentication required'): AppError {
  return new AppError('UNAUTHORIZED', message, 401)
}

export function conflict(code: string, message: string): AppError {
  return new AppError(code, message, 409)
}