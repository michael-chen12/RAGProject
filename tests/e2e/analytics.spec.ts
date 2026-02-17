import { test, expect } from '@playwright/test'

/**
 * E2E tests for the Analytics Dashboard (TASK-008).
 *
 * Prerequisites:
 *   - TEST_WORKSPACE_ID env var must be set to a seeded workspace
 *   - User must be authenticated (via storageState cookie in playwright.config.ts)
 */

const workspaceId = process.env.TEST_WORKSPACE_ID ?? ''

test.beforeAll(() => {
  if (!workspaceId) {
    console.warn('Skipping analytics E2E: TEST_WORKSPACE_ID not set')
  }
})

test.describe('Analytics Dashboard', () => {
  test('shows workspace name in heading', async ({ page }) => {
    test.skip(!workspaceId, 'TEST_WORKSPACE_ID not configured')

    await page.goto(`/${workspaceId}`)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('renders usage chart section', async ({ page }) => {
    test.skip(!workspaceId, 'TEST_WORKSPACE_ID not configured')

    await page.goto(`/${workspaceId}`)
    await expect(page.getByText('Chat Volume')).toBeVisible()
  })

  test('renders feedback summary section', async ({ page }) => {
    test.skip(!workspaceId, 'TEST_WORKSPACE_ID not configured')

    await page.goto(`/${workspaceId}`)
    await expect(page.getByText('User Feedback')).toBeVisible()
  })

  test('renders top queries section', async ({ page }) => {
    test.skip(!workspaceId, 'TEST_WORKSPACE_ID not configured')

    await page.goto(`/${workspaceId}`)
    await expect(page.getByText('Top Queries')).toBeVisible()
  })

  test('renders missing KB entries table', async ({ page }) => {
    test.skip(!workspaceId, 'TEST_WORKSPACE_ID not configured')

    await page.goto(`/${workspaceId}`)
    await expect(page.getByText('Unanswered / Low-Confidence Queries')).toBeVisible()
  })

  test('recharts does not appear in initial HTML (ssr:false)', async ({ page }) => {
    test.skip(!workspaceId, 'TEST_WORKSPACE_ID not configured')

    // The SVG chart is injected client-side; the page HTML should not contain recharts SVG
    const response = await page.request.get(`/${workspaceId}`)
    const html = await response.text()
    // recharts renders <svg> with class="recharts-surface" — not present in SSR output
    expect(html).not.toContain('recharts-surface')
  })
})
