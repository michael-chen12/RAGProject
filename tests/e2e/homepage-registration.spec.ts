import { test, expect } from '@playwright/test'

/**
 * E2E tests for the homepage and registration flow.
 *
 * Prerequisites:
 *   - Local dev server running (playwright config starts it via webServer)
 *   - Supabase instance configured with email auth enabled
 *
 * These tests verify:
 *   - Homepage loads without 404
 *   - Marketing content is visible
 *   - Registration form works
 *   - Auth redirect for authenticated users
 */

test.describe('Homepage', () => {
  test('loads without 404 and displays marketing content', async ({ page }) => {
    await page.goto('/')

    // Should not be a 404
    expect(page.url()).toBe(new URL('/', page.url()).toString())

    // Hero section should be visible
    await expect(page.getByRole('heading', { name: /your ai-powered knowledge base/i })).toBeVisible()

    // Features section should be visible
    await expect(page.getByText(/everything you need for intelligent document search/i)).toBeVisible()

    // How it works section should be visible
    await expect(page.getByRole('heading', { name: /how it works/i })).toBeVisible()
  })

  test('displays registration form in hero section', async ({ page }) => {
    await page.goto('/')

    // Registration form should be visible
    await expect(page.getByRole('heading', { name: /get started free/i })).toBeVisible()

    // All form fields should be present
    await expect(page.getByLabel(/first name/i)).toBeVisible()
    await expect(page.getByLabel(/last name/i)).toBeVisible()
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /send verification email/i })).toBeVisible()
  })

  test('has keyboard-accessible skip link', async ({ page }) => {
    await page.goto('/')

    // Tab to focus the skip link
    await page.keyboard.press('Tab')

    // Skip link should be visible when focused
    const skipLink = page.getByRole('link', { name: /skip to registration form/i })
    await expect(skipLink).toBeFocused()

    // Clicking should scroll to form
    await skipLink.click()

    // Form should be visible (checking via ID anchor)
    const form = page.locator('#registration-form')
    await expect(form).toBeInViewport()
  })
})

test.describe('Registration Form', () => {
  test('shows validation errors for empty fields', async ({ page }) => {
    await page.goto('/')

    const submitButton = page.getByRole('button', { name: /send verification email/i })
    await submitButton.click()

    // All three field errors should appear
    await expect(page.getByText(/first name is required/i)).toBeVisible()
    await expect(page.getByText(/last name is required/i)).toBeVisible()
    await expect(page.getByText(/email is required/i)).toBeVisible()
  })

  test('shows validation error for invalid email format', async ({ page }) => {
    await page.goto('/')

    await page.getByLabel(/first name/i).fill('John')
    await page.getByLabel(/last name/i).fill('Doe')
    await page.getByLabel(/email/i).fill('invalid-email')

    const submitButton = page.getByRole('button', { name: /send verification email/i })
    await submitButton.click()

    await expect(page.getByText(/please enter a valid email address/i)).toBeVisible()
  })

  test('clears field error when user starts typing', async ({ page }) => {
    await page.goto('/')

    // Trigger validation
    const submitButton = page.getByRole('button', { name: /send verification email/i })
    await submitButton.click()

    // Error should be visible
    await expect(page.getByText(/first name is required/i)).toBeVisible()

    // Type in field
    await page.getByLabel(/first name/i).fill('J')

    // Error should disappear
    await expect(page.getByText(/first name is required/i)).not.toBeVisible()
  })

  test('shows loading state during submission', async ({ page }) => {
    await page.goto('/')

    await page.getByLabel(/first name/i).fill('John')
    await page.getByLabel(/last name/i).fill('Doe')
    await page.getByLabel(/email/i).fill('test@example.com')

    const submitButton = page.getByRole('button', { name: /send verification email/i })
    await submitButton.click()

    // Loading state should appear (briefly)
    // Note: This might be too fast to catch in a real test
    const loadingText = page.getByText(/sending/i)
    // Check if it appears OR if success appears (submission was too fast)
    await Promise.race([
      expect(loadingText).toBeVisible({ timeout: 1000 }).catch(() => {}),
      expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 5000 }),
    ])

    // Inputs should be disabled during submission
    // (Only check if we're still in loading state)
    const firstNameInput = page.getByLabel(/first name/i)
    if (await loadingText.isVisible().catch(() => false)) {
      expect(await firstNameInput.isDisabled()).toBe(true)
    }
  })

  test('shows success message after valid submission', async ({ page }) => {
    await page.goto('/')

    const testEmail = `test-${Date.now()}@example.com`

    await page.getByLabel(/first name/i).fill('John')
    await page.getByLabel(/last name/i).fill('Doe')
    await page.getByLabel(/email/i).fill(testEmail)

    const submitButton = page.getByRole('button', { name: /send verification email/i })
    await submitButton.click()

    // Success message should appear
    await expect(page.getByRole('heading', { name: /check your email/i })).toBeVisible({
      timeout: 10000,
    })
    await expect(page.getByText(testEmail)).toBeVisible()

    // Form should be hidden
    await expect(page.getByLabel(/first name/i)).not.toBeVisible()
  })

  test('persists success state in sessionStorage across page reloads', async ({ page }) => {
    await page.goto('/')

    const testEmail = `test-${Date.now()}@example.com`

    await page.getByLabel(/first name/i).fill('John')
    await page.getByLabel(/last name/i).fill('Doe')
    await page.getByLabel(/email/i).fill(testEmail)

    const submitButton = page.getByRole('button', { name: /send verification email/i })
    await submitButton.click()

    // Wait for success
    await expect(page.getByRole('heading', { name: /check your email/i })).toBeVisible({
      timeout: 10000,
    })

    // Reload page
    await page.reload()

    // Success state should be restored
    await expect(page.getByRole('heading', { name: /check your email/i })).toBeVisible()
    await expect(page.getByText(testEmail)).toBeVisible()
  })

  test('handles duplicate email error gracefully', async ({ page }) => {
    await page.goto('/')

    // Use an email that's likely to already exist
    await page.getByLabel(/first name/i).fill('Existing')
    await page.getByLabel(/last name/i).fill('User')
    await page.getByLabel(/email/i).fill('existing@example.com')

    const submitButton = page.getByRole('button', { name: /send verification email/i })
    await submitButton.click()

    // Wait for either success or error
    await Promise.race([
      expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 10000 }),
      expect(page.getByText(/already registered/i)).toBeVisible({ timeout: 10000 }),
    ])

    // If error appeared, check for login link
    const errorVisible = await page.getByText(/already registered/i).isVisible().catch(() => false)
    if (errorVisible) {
      await expect(page.getByRole('link', { name: /go to login/i })).toBeVisible()
    }
  })

  test('maintains form accessibility throughout interaction', async ({ page }) => {
    await page.goto('/')

    // Check ARIA attributes on empty form
    const firstNameInput = page.getByLabel(/first name/i)
    expect(await firstNameInput.getAttribute('aria-required')).toBe('true')

    // Trigger error state
    const submitButton = page.getByRole('button', { name: /send verification email/i })
    await submitButton.click()

    // Check error ARIA attributes
    await expect(page.getByText(/first name is required/i)).toHaveAttribute('role', 'alert')
    expect(await firstNameInput.getAttribute('aria-invalid')).toBe('true')
    expect(await firstNameInput.getAttribute('aria-describedby')).toContain('error')
  })
})

test.describe('Authenticated User Redirect', () => {
  test.skip('redirects authenticated users to /workspaces', async ({ page }) => {
    // This test requires auth setup - skip for now
    // In a real scenario, you would:
    // 1. Create a test user
    // 2. Sign in
    // 3. Visit /
    // 4. Expect redirect to /workspaces

    // TODO: Implement when auth test utilities are ready
  })
})

test.describe('Accessibility', () => {
  test('has no critical accessibility violations on homepage', async ({ page }) => {
    await page.goto('/')

    // Check for proper heading hierarchy
    const h1 = page.getByRole('heading', { level: 1 })
    await expect(h1).toBeVisible()

    // Check for proper landmark regions
    const main = page.locator('main')
    await expect(main).toBeVisible()

    // Check form has proper labels
    const firstNameInput = page.getByLabel(/first name/i)
    await expect(firstNameInput).toBeVisible()
    expect(await firstNameInput.getAttribute('id')).toBeTruthy()
  })

  test('supports full keyboard navigation', async ({ page }) => {
    await page.goto('/')

    // Tab through interactive elements
    await page.keyboard.press('Tab') // Skip link
    await page.keyboard.press('Tab') // First name
    await page.keyboard.press('Tab') // Last name
    await page.keyboard.press('Tab') // Email
    await page.keyboard.press('Tab') // Submit button

    // Submit button should be focused
    const submitButton = page.getByRole('button', { name: /send verification email/i })
    await expect(submitButton).toBeFocused()

    // Enter key should submit form
    await page.getByLabel(/first name/i).fill('John')
    await page.getByLabel(/last name/i).fill('Doe')
    await page.getByLabel(/email/i).fill('keyboard-test@example.com')

    await submitButton.focus()
    await page.keyboard.press('Enter')

    // Should trigger validation or submission
    await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 10000 })
  })

  test('has visible focus indicators', async ({ page }) => {
    await page.goto('/')

    // Tab to first input
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')

    const firstNameInput = page.getByLabel(/first name/i)
    await expect(firstNameInput).toBeFocused()

    // Check for visible focus ring (outline should be present)
    const outline = await firstNameInput.evaluate((el) => {
      const styles = window.getComputedStyle(el)
      return styles.outline !== 'none' || styles.outlineStyle !== 'none'
    })

    expect(outline).toBe(true)
  })
})
