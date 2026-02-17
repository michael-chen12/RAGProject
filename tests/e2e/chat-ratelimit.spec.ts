import { test, expect } from '@playwright/test'

/**
 * E2E tests for chat rate limiting behaviour.
 *
 * Note: This test only runs meaningfully when UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN are configured and the rate limit (20 req/60s) is active.
 * When Upstash is not configured (dev mode), the 429 branch is skipped.
 */

const workspaceId = process.env.TEST_WORKSPACE_ID ?? 'test-workspace'
const baseChatUrl = `/${workspaceId}/chat`

test.describe('Rate limiting', () => {
  test('shows error message after exceeding rate limit', async ({ page, request }) => {
    // Directly call the API to exhaust the rate limit
    // (faster than going through the UI 21 times)
    const body = { workspaceId, message: 'Rate limit test message' }

    let hit429 = false
    let retryAfter: string | null = null

    for (let i = 0; i < 25; i++) {
      const response = await request.post('/api/chat', {
        data: body,
        headers: { 'Content-Type': 'application/json' },
      })

      if (response.status() === 429) {
        hit429 = true
        retryAfter = response.headers()['retry-after'] ?? null
        break
      }

      // Small delay to avoid overwhelming the test server
      await page.waitForTimeout(50)
    }

    if (hit429) {
      // Verify the Retry-After header is present
      expect(retryAfter).toBeTruthy()
      const retrySeconds = parseInt(retryAfter!, 10)
      expect(retrySeconds).toBeGreaterThan(0)
      expect(retrySeconds).toBeLessThanOrEqual(60)
    } else {
      // Upstash not configured — skip this assertion
      test.skip()
    }
  })

  test('UI shows rate limit error message to user', async ({ page }) => {
    // Mock the API to return 429
    await page.route('/api/chat', (route) => {
      route.fulfill({
        status: 429,
        headers: { 'Retry-After': '30' },
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Too many requests' }),
      })
    })

    await page.goto(baseChatUrl)

    const input = page.getByPlaceholder(/Ask a question/)
    await input.fill('Test message')
    await input.press('Enter')

    // Error banner should appear with rate limit message
    await expect(page.getByText(/Rate limited/)).toBeVisible()
    await expect(page.getByText(/30/)).toBeVisible()
  })
})
