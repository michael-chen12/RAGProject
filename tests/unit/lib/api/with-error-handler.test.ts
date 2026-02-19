import { NextRequest } from 'next/server'
import { withErrorHandler } from '@/lib/api/with-error-handler'
import { ApiError, Errors } from '@/lib/api/errors'

// Helper to create a mock NextRequest
function makeReq(path = '/api/test', method = 'GET'): NextRequest {
  return new NextRequest(`http://localhost${path}`, { method })
}

// Helper to parse JSON response body
async function parseBody(res: Response) {
  const text = await res.text()
  return JSON.parse(text)
}

describe('withErrorHandler', () => {
  describe('request ID', () => {
    it('adds X-Request-Id header to successful responses', async () => {
      const handler = async () => new Response(JSON.stringify({ ok: true }), { status: 200 })
      const wrapped = withErrorHandler(handler)
      const res = await wrapped(makeReq())
      expect(res.headers.get('X-Request-Id')).toBeTruthy()
      // UUID format (8-4-4-4-12 hex)
      expect(res.headers.get('X-Request-Id')).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      )
    })

    it('adds X-Request-Id header to error responses', async () => {
      const handler = async () => { throw Errors.unauthorized() }
      const wrapped = withErrorHandler(handler)
      const res = await wrapped(makeReq())
      expect(res.headers.get('X-Request-Id')).toBeTruthy()
    })

    it('generates unique request IDs per request', async () => {
      const handler = async () => new Response('{}', { status: 200 })
      const wrapped = withErrorHandler(handler)
      const [res1, res2] = await Promise.all([wrapped(makeReq()), wrapped(makeReq())])
      expect(res1.headers.get('X-Request-Id')).not.toBe(res2.headers.get('X-Request-Id'))
    })
  })

  describe('successful responses', () => {
    it('passes through the response body and status unchanged', async () => {
      const payload = { message: 'hello' }
      const handler = async () => new Response(JSON.stringify(payload), { status: 200 })
      const wrapped = withErrorHandler(handler)
      const res = await wrapped(makeReq())
      expect(res.status).toBe(200)
      expect(await parseBody(res)).toEqual(payload)
    })

    it('preserves non-200 success status codes', async () => {
      const handler = async () => new Response('{}', { status: 201 })
      const wrapped = withErrorHandler(handler)
      const res = await wrapped(makeReq())
      expect(res.status).toBe(201)
    })
  })

  describe('ApiError handling', () => {
    it('converts unauthorized ApiError to 401 JSON response', async () => {
      const handler = async () => { throw Errors.unauthorized() }
      const wrapped = withErrorHandler(handler)
      const res = await wrapped(makeReq())
      expect(res.status).toBe(401)
      const body = await parseBody(res)
      expect(body.code).toBe('AUTH_REQUIRED')
      expect(body.error).toBeTruthy()
    })

    it('converts forbidden ApiError to 403 JSON response', async () => {
      const handler = async () => { throw Errors.forbidden('Permission denied') }
      const wrapped = withErrorHandler(handler)
      const res = await wrapped(makeReq())
      expect(res.status).toBe(403)
      const body = await parseBody(res)
      expect(body.code).toBe('FORBIDDEN')
    })

    it('converts validation ApiError to 400 with VALIDATION_ERROR code', async () => {
      const handler = async () => { throw Errors.validation('Field required') }
      const wrapped = withErrorHandler(handler)
      const res = await wrapped(makeReq())
      expect(res.status).toBe(400)
      const body = await parseBody(res)
      expect(body.code).toBe('VALIDATION_ERROR')
      expect(body.error).toBe('Field required')
    })

    it('converts notFound ApiError to 404 response', async () => {
      const handler = async () => { throw Errors.notFound() }
      const wrapped = withErrorHandler(handler)
      const res = await wrapped(makeReq())
      expect(res.status).toBe(404)
    })

    it('converts rateLimited ApiError to 429 with Retry-After header', async () => {
      const handler = async () => { throw Errors.rateLimited(60) }
      const wrapped = withErrorHandler(handler)
      const res = await wrapped(makeReq())
      expect(res.status).toBe(429)
      expect(res.headers.get('Retry-After')).toBe('60')
      const body = await parseBody(res)
      expect(body.code).toBe('RATE_LIMITED')
    })

    it('does NOT expose stack trace in ApiError response', async () => {
      const handler = async () => { throw Errors.unauthorized() }
      const wrapped = withErrorHandler(handler)
      const res = await wrapped(makeReq())
      const body = await parseBody(res)
      expect(body).not.toHaveProperty('stack')
      expect(JSON.stringify(body)).not.toContain('at ')
    })

    it('response body has exactly error and code fields', async () => {
      const handler = async () => { throw Errors.notFound('Custom message') }
      const wrapped = withErrorHandler(handler)
      const res = await wrapped(makeReq())
      const body = await parseBody(res)
      expect(Object.keys(body).sort()).toEqual(['code', 'error'])
    })
  })

  describe('unexpected error handling', () => {
    it('returns 500 with INTERNAL_ERROR code for unexpected errors', async () => {
      const handler = async () => { throw new Error('Database connection refused') }
      const wrapped = withErrorHandler(handler)
      const res = await wrapped(makeReq())
      expect(res.status).toBe(500)
      const body = await parseBody(res)
      expect(body.code).toBe('INTERNAL_ERROR')
    })

    it('does NOT expose internal error details to client', async () => {
      const handler = async () => { throw new Error('SELECT * FROM users WHERE secret=true') }
      const wrapped = withErrorHandler(handler)
      const res = await wrapped(makeReq())
      const body = await parseBody(res)
      // The raw error message should not leak
      expect(JSON.stringify(body)).not.toContain('SELECT')
      expect(body).not.toHaveProperty('stack')
    })

    it('returns 500 for thrown strings', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = async () => { throw 'string error' as any }
      const wrapped = withErrorHandler(handler)
      const res = await wrapped(makeReq())
      expect(res.status).toBe(500)
    })
  })
})
