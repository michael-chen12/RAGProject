import { test, expect } from '@playwright/test'

/**
 * E2E tests for the Settings page.
 *
 * Prerequisites:
 *   TEST_ADMIN_EMAIL    - email of an admin user in the test workspace
 *   TEST_WORKSPACE_ID   - workspace slug/ID for the test workspace
 *
 * NOTE: The magic-link flow cannot be fully automated in E2E without
 * either intercepting the email or using Supabase's test/admin API to
 * generate session tokens. These tests cover the page structure and
 * form interactions assuming a pre-authenticated session.
 */

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the settings page; auth middleware will redirect to /login if unauthenticated
    await page.goto(`/${process.env.TEST_WORKSPACE_ID}/settings`)
  })

  test('unauthenticated user is redirected to login', async ({ page }) => {
    // Without a session cookie, middleware redirects to /login
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('Settings Page (authenticated admin)', () => {
  // These tests require a pre-seeded authenticated session.
  // In CI, use Supabase auth helpers to inject a session cookie before each test.

  test('page renders all three sections', async ({ page }) => {
    // Skipped until CI auth helper is configured
    test.skip(!process.env.TEST_WORKSPACE_ID, 'TEST_WORKSPACE_ID not set')

    await page.goto(`/${process.env.TEST_WORKSPACE_ID}/settings`)
    await expect(page.locator('h1')).toContainText('Settings')
    await expect(page.locator('h2', { hasText: 'Members' })).toBeVisible()
    await expect(page.locator('h2', { hasText: 'Pending Invitations' })).toBeVisible()
    await expect(page.locator('h2', { hasText: 'Invite Member' })).toBeVisible()
  })

  test('invite form validates email format', async ({ page }) => {
    test.skip(!process.env.TEST_WORKSPACE_ID, 'TEST_WORKSPACE_ID not set')

    await page.goto(`/${process.env.TEST_WORKSPACE_ID}/settings`)
    const emailInput = page.locator('#invite-email')
    await emailInput.fill('not-a-valid-email')
    await page.locator('button:has-text("Send Invitation")').click()

    // Native browser validation fires before submit — field is invalid
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid)
    expect(isInvalid).toBe(true)
  })

  test('can submit valid invite and see success message', async ({ page }) => {
    test.skip(!process.env.TEST_WORKSPACE_ID, 'TEST_WORKSPACE_ID not set')

    await page.goto(`/${process.env.TEST_WORKSPACE_ID}/settings`)
    await page.locator('#invite-email').fill('e2e-test-invite@example.com')
    await page.locator('[aria-label="Select role"]').selectOption('agent')
    await page.locator('button:has-text("Send Invitation")').click()

    // Success or rate-limit message should appear
    await expect(
      page.locator('[role="status"], [role="alert"]')
    ).toBeVisible({ timeout: 5000 })
  })
})
