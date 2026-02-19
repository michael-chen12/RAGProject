import { test, expect } from '@playwright/test'

/**
 * E2E tests for centralized error handling across all API routes.
 * Verifies:
 * - Standardized error response format: { error: string, code: ErrorCode }
 * - X-Request-Id header on all responses
 * - No stack traces exposed in error responses
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

test.describe('API Error Handling', () => {
  test.describe('Unauthorized (401) responses', () => {
    test('GET /api/profile returns 401 with AUTH_REQUIRED code when not authenticated', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/profile`)
      expect(response.status()).toBe(401)

      const body = await response.json()
      expect(body).toHaveProperty('error')
      expect(body).toHaveProperty('code', 'AUTH_REQUIRED')
      expect(body).not.toHaveProperty('stack')

      // X-Request-Id header must be present
      expect(response.headers()['x-request-id']).toBeTruthy()
      expect(response.headers()['x-request-id']).toMatch(/^[0-9a-f-]{36}$/)
    })

    test('GET /api/chat/threads returns 401 with standard format', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/chat/threads?workspaceId=test`)
      expect(response.status()).toBe(401)

      const body = await response.json()
      expect(body.code).toBe('AUTH_REQUIRED')
      expect(response.headers()['x-request-id']).toBeTruthy()
    })
  })

  test.describe('Bad Request (400) responses', () => {
    // Note: We can't easily test authenticated routes in E2E without auth setup,
    // but we can test validation on public endpoints that require specific params.

    test('Missing required query param returns 400 with VALIDATION_ERROR code', async ({ request }) => {
      // This would require auth, so skip in basic E2E. Unit tests cover this.
      test.skip()
    })

    test('Invalid JSON returns 400 with INVALID_JSON code', async ({ request }) => {
      // This would require auth to hit the JSON parsing path. Unit tests cover this.
      test.skip()
    })
  })

  test.describe('X-Request-Id header', () => {
    test('Present on successful responses', async ({ request }) => {
      // Test a public endpoint (this will 401, but that's a "successful" error response)
      const response = await request.get(`${BASE_URL}/api/profile`)
      expect(response.headers()['x-request-id']).toBeTruthy()
      expect(response.headers()['x-request-id']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    })

    test('Unique per request', async ({ request }) => {
      const [res1, res2] = await Promise.all([
        request.get(`${BASE_URL}/api/profile`),
        request.get(`${BASE_URL}/api/profile`),
      ])

      const id1 = res1.headers()['x-request-id']
      const id2 = res2.headers()['x-request-id']

      expect(id1).toBeTruthy()
      expect(id2).toBeTruthy()
      expect(id1).not.toBe(id2)
    })
  })

  test.describe('Error response format consistency', () => {
    test('Error responses have exactly { error, code } structure', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/profile`)
      const body = await response.json()

      const keys = Object.keys(body).sort()
      expect(keys).toEqual(['code', 'error'])
    })

    test('No stack traces in error responses', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/profile`)
      const body = await response.json()
      const bodyString = JSON.stringify(body)

      expect(body).not.toHaveProperty('stack')
      expect(bodyString).not.toContain('at ')
      expect(bodyString).not.toContain('.ts:')
    })

    test('Content-Type is application/json for errors', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/profile`)
      expect(response.headers()['content-type']).toContain('application/json')
    })
  })

  test.describe('Multiple API routes use error handler', () => {
    // Smoke test that various routes return standardized error format
    const routesToTest = [
      '/api/profile',
      '/api/feedback',
      '/api/tickets?workspaceId=test',
      '/api/workspaces/test-id/collections',
      '/api/workspaces/test-id/members',
    ]

    for (const route of routesToTest) {
      test(`${route} returns standardized error format`, async ({ request }) => {
        const response = await request.get(`${BASE_URL}${route}`)
        const body = await response.json()

        expect(body).toHaveProperty('error')
        expect(body).toHaveProperty('code')
        expect(response.headers()['x-request-id']).toBeTruthy()
        expect(body).not.toHaveProperty('stack')
      })
    }
  })
})
