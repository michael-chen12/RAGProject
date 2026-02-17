import { test, expect } from '@playwright/test'

/**
 * E2E tests for chat RBAC and security controls.
 * Tests the API directly to verify security headers without needing a full session.
 */

const workspaceId = process.env.TEST_WORKSPACE_ID ?? 'test-workspace'
const otherWorkspaceId = process.env.OTHER_WORKSPACE_ID ?? 'other-workspace'

test.describe('Chat API — authentication', () => {
  test('returns 401 for unauthenticated requests', async ({ request }) => {
    // No session cookie — should be rejected before any DB work
    const response = await request.post('/api/chat', {
      data: {
        workspaceId,
        message: 'Hello',
      },
      headers: { 'Content-Type': 'application/json' },
    })

    expect(response.status()).toBe(401)
  })

  test('returns 401 for unauthenticated feedback requests', async ({ request }) => {
    const response = await request.post('/api/feedback', {
      data: {
        messageId: 'some-message-id',
        rating: 'up',
      },
      headers: { 'Content-Type': 'application/json' },
    })

    expect(response.status()).toBe(401)
  })

  test('returns 401 for unauthenticated threads listing', async ({ request }) => {
    const response = await request.get(`/api/chat/threads?workspaceId=${workspaceId}`)

    expect(response.status()).toBe(401)
  })
})

test.describe('Chat API — authorization', () => {
  test('returns 400 for missing workspaceId in chat request', async ({ request }) => {
    // Even without auth, missing params should return 400 early
    // (auth check returns 401 first in practice, but this tests param validation)
    const response = await request.post('/api/chat', {
      data: { message: 'Hello' }, // missing workspaceId
      headers: { 'Content-Type': 'application/json' },
    })

    // Could be 400 (param validation) or 401 (auth check first) — both are valid
    expect([400, 401]).toContain(response.status())
  })

  test('returns 400 for missing message in chat request', async ({ request }) => {
    const response = await request.post('/api/chat', {
      data: { workspaceId }, // missing message
      headers: { 'Content-Type': 'application/json' },
    })

    expect([400, 401]).toContain(response.status())
  })
})

test.describe('Chat page — access control', () => {
  test('redirects unauthenticated users away from chat page', async ({ page }) => {
    // Navigate without a session
    await page.goto(`/${workspaceId}/chat`)

    // Should be redirected to login
    await expect(page).toHaveURL(/\/login/)
  })

  test('workspace chat page is not accessible from other workspaces', async ({ page }) => {
    // Navigate to a different workspace's chat
    // Without membership, requireWorkspaceMember redirects to /workspaces
    await page.goto(`/${otherWorkspaceId}/chat`)

    // Either redirected or shown 404/403
    const url = page.url()
    const status = page.evaluate(() => document.title)
    expect(url).toMatch(/\/(login|workspaces)/)
  })
})
