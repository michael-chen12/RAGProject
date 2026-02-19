import { ApiError, Errors, type ErrorCode } from '@/lib/api/errors'

describe('ApiError', () => {
  it('creates an error with the correct code and status', () => {
    const err = new ApiError('AUTH_REQUIRED', 'Authentication required')
    expect(err.code).toBe('AUTH_REQUIRED')
    expect(err.status).toBe(401)
    expect(err.message).toBe('Authentication required')
    expect(err.headers).toEqual({})
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('ApiError')
  })

  it('stores optional headers', () => {
    const err = new ApiError('RATE_LIMITED', 'Too many requests', { 'Retry-After': '60' })
    expect(err.headers['Retry-After']).toBe('60')
  })

  describe('toResponse()', () => {
    it('returns body with error and code (no stack)', () => {
      const err = new ApiError('NOT_FOUND', 'Resource not found')
      const res = err.toResponse()
      expect(res.body).toEqual({ error: 'Resource not found', code: 'NOT_FOUND' })
      expect(res.status).toBe(404)
      expect(res.body).not.toHaveProperty('stack')
    })

    it('returns headers', () => {
      const err = new ApiError('RATE_LIMITED', 'Rate limited', { 'Retry-After': '3600' })
      expect(err.toResponse().headers['Retry-After']).toBe('3600')
    })
  })

  // Verify all codes map to expected HTTP statuses
  const statusMatrix: Array<[ErrorCode, number]> = [
    ['AUTH_REQUIRED',    401],
    ['FORBIDDEN',        403],
    ['VALIDATION_ERROR', 400],
    ['INVALID_JSON',     400],
    ['NOT_FOUND',        404],
    ['CONFLICT',         409],
    ['RATE_LIMITED',     429],
    ['INTERNAL_ERROR',   500],
  ]

  it.each(statusMatrix)('%s maps to HTTP %i', (code, expectedStatus) => {
    const err = new ApiError(code, 'test')
    expect(err.status).toBe(expectedStatus)
  })
})

describe('Errors factory', () => {
  it('unauthorized() returns 401 ApiError', () => {
    const err = Errors.unauthorized()
    expect(err.code).toBe('AUTH_REQUIRED')
    expect(err.status).toBe(401)
  })

  it('forbidden() returns 403 ApiError', () => {
    const err = Errors.forbidden()
    expect(err.code).toBe('FORBIDDEN')
    expect(err.status).toBe(403)
  })

  it('validation() returns 400 ApiError', () => {
    const err = Errors.validation('Bad input')
    expect(err.code).toBe('VALIDATION_ERROR')
    expect(err.status).toBe(400)
    expect(err.message).toBe('Bad input')
  })

  it('invalidJson() returns 400 INVALID_JSON', () => {
    const err = Errors.invalidJson()
    expect(err.code).toBe('INVALID_JSON')
    expect(err.status).toBe(400)
  })

  it('notFound() returns 404 ApiError', () => {
    const err = Errors.notFound()
    expect(err.code).toBe('NOT_FOUND')
    expect(err.status).toBe(404)
  })

  it('conflict() returns 409 ApiError', () => {
    const err = Errors.conflict('Duplicate slug')
    expect(err.code).toBe('CONFLICT')
    expect(err.status).toBe(409)
  })

  it('rateLimited() returns 429 with Retry-After header', () => {
    const err = Errors.rateLimited(3600)
    expect(err.code).toBe('RATE_LIMITED')
    expect(err.status).toBe(429)
    expect(err.headers['Retry-After']).toBe('3600')
  })

  it('rateLimited() without seconds has no Retry-After', () => {
    const err = Errors.rateLimited()
    expect(err.headers).toEqual({})
  })

  it('internal() returns 500 ApiError', () => {
    const err = Errors.internal()
    expect(err.code).toBe('INTERNAL_ERROR')
    expect(err.status).toBe(500)
  })

  it('all factory errors are instanceof ApiError', () => {
    expect(Errors.unauthorized()).toBeInstanceOf(ApiError)
    expect(Errors.forbidden()).toBeInstanceOf(ApiError)
    expect(Errors.notFound()).toBeInstanceOf(ApiError)
    expect(Errors.internal()).toBeInstanceOf(ApiError)
  })
})
