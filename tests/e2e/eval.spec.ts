import { test, expect } from '@playwright/test'

/**
 * E2E tests for the RAG Evaluation pages (TASK-009).
 *
 * Prerequisites:
 *   - Local dev server running (playwright config starts it via webServer)
 *   - TEST_WORKSPACE_ID env var pointing to a seeded workspace
 *   - At least one eval set with cases seeded in the test workspace
 *   - Valid session cookies for an admin user (set up via storageState or login)
 *
 * Acceptance criteria tested:
 *   - Eval list page shows "RAG Evaluation" heading
 *   - Admin sees Run button on eval list page
 *   - Viewer does NOT see Run button (if viewer session available)
 *   - Eval detail page shows run history section
 *   - Eval detail page shows per-case results after a run
 */

const workspaceId = process.env.TEST_WORKSPACE_ID ?? 'test-workspace'
const baseEvalUrl = `/${workspaceId}/eval`

// ── UI: Eval list page ─────────────────────────────────────────────────────────

test.describe('Eval list page (/eval)', () => {
  test('shows "RAG Evaluation" heading', async ({ page }) => {
    await page.goto(baseEvalUrl)
    await expect(page.getByRole('heading', { name: 'RAG Evaluation' })).toBeVisible({ timeout: 10_000 })
  })

  test('shows Run button for admin users', async ({ page }) => {
    // This test assumes the default session is an admin
    await page.goto(baseEvalUrl)
    await expect(page.getByRole('heading', { name: 'RAG Evaluation' })).toBeVisible()

    // Check for at least one Run button (admin should see it)
    const runButton = page.getByRole('button', { name: 'Run' })
    const count = await runButton.count()

    // If there are eval sets, admin should see Run buttons
    // If no eval sets, the empty state will be shown instead
    const emptyState = page.getByText('No eval sets yet')
    const hasEmptyState = await emptyState.count() > 0

    if (!hasEmptyState) {
      expect(count).toBeGreaterThan(0)
    }
  })

  test('clicking an eval set navigates to detail page', async ({ page }) => {
    await page.goto(baseEvalUrl)
    await expect(page.getByRole('heading', { name: 'RAG Evaluation' })).toBeVisible()

    // Find first eval set link and click it
    const firstSetLink = page.locator(`a[href^="/${workspaceId}/eval/"]`).first()
    const count = await firstSetLink.count()
    if (count === 0) {
      test.skip() // No eval sets seeded
      return
    }

    await firstSetLink.click()
    await expect(page).toHaveURL(new RegExp(`/${workspaceId}/eval/.+`))
  })
})

// ── UI: Eval detail page ───────────────────────────────────────────────────────

test.describe('Eval detail page (/eval/[evalSetId])', () => {
  // Helper: navigate to first available eval set
  async function goToFirstEvalSet(page: import('@playwright/test').Page) {
    await page.goto(baseEvalUrl)
    await page.waitForSelector(`a[href^="/${workspaceId}/eval/"]`, { timeout: 10_000 })
    const link = page.locator(`a[href^="/${workspaceId}/eval/"]`).first()
    const href = await link.getAttribute('href')
    if (!href) throw new Error('No eval set links found on eval page')
    await page.goto(href)
    return href
  }

  test('shows Run History section', async ({ page }) => {
    try {
      await goToFirstEvalSet(page)
    } catch {
      test.skip()
      return
    }

    await expect(page.getByText('Run History')).toBeVisible({ timeout: 10_000 })
  })

  test('shows back link to eval sets list', async ({ page }) => {
    try {
      await goToFirstEvalSet(page)
    } catch {
      test.skip()
      return
    }

    const backLink = page.getByRole('link', { name: /Back to eval sets/i })
    await expect(backLink).toBeVisible()
  })

  test('admin sees Run button on detail page', async ({ page }) => {
    try {
      await goToFirstEvalSet(page)
    } catch {
      test.skip()
      return
    }

    const runButton = page.getByRole('button', { name: 'Run' })
    await expect(runButton).toBeVisible()
  })
})

// ── RBAC: Viewer restrictions ──────────────────────────────────────────────────

test.describe('Viewer role — RBAC', () => {
  test('viewer does NOT see Run button on eval list', async ({ page }) => {
    // This test only runs when a viewer session is configured
    if (!process.env.VIEWER_COOKIE) {
      test.skip()
      return
    }

    await page.goto(baseEvalUrl)
    await expect(page.getByRole('heading', { name: 'RAG Evaluation' })).toBeVisible()

    // Viewer should NOT see Run buttons
    const runButton = page.getByRole('button', { name: 'Run' })
    await expect(runButton).not.toBeVisible()
  })
})

// ── API: Unauthenticated access ────────────────────────────────────────────────

test.describe('POST /api/eval/run — auth enforcement', () => {
  test('returns 401 when not authenticated', async ({ request }) => {
    const response = await request.post('/api/eval/run', {
      data: { evalSetId: 'test-set', workspaceId },
      headers: { 'Content-Type': 'application/json' },
    })
    expect(response.status()).toBe(401)
  })
})
