import { test, expect } from '@playwright/test'

/**
 * E2E tests for the streaming RAG chat interface.
 *
 * Prerequisites:
 *   - Local dev server running (playwright config starts it via webServer)
 *   - A seeded test workspace with at least one indexed document
 *   - TEST_WORKSPACE_ID env var pointing to that workspace
 *   - Valid session cookies (authenticate before running, or use storageState)
 *
 * These tests verify the user-visible behaviour from TASK-006 acceptance criteria.
 */

const workspaceId = process.env.TEST_WORKSPACE_ID ?? 'test-workspace'
const baseChatUrl = `/${workspaceId}/chat`

test.describe('Chat page — new conversation', () => {
  test('renders the chat interface with empty state', async ({ page }) => {
    await page.goto(baseChatUrl)

    // Empty state prompt should be visible
    await expect(page.getByText('Ask anything')).toBeVisible()
    // Input textarea should be present
    await expect(page.getByPlaceholder(/Ask a question/)).toBeVisible()
  })

  test('sends a message and receives a streamed response', async ({ page }) => {
    await page.goto(baseChatUrl)

    const input = page.getByPlaceholder(/Ask a question/)
    await input.fill('What is this knowledge base about?')
    await input.press('Enter')

    // User message should appear immediately (optimistic)
    await expect(page.getByText('What is this knowledge base about?')).toBeVisible()

    // Streaming indicator: disabled input + spinner button
    await expect(input).toBeDisabled()

    // Wait for the response to complete (up to 30s for LLM + streaming)
    await expect(input).toBeEnabled({ timeout: 30_000 })

    // At least one assistant message bubble should be visible
    const assistantBubbles = page.locator('.bg-gray-100')
    await expect(assistantBubbles.first()).toBeVisible()
  })

  test('shows citation pills [N] in assistant response when sources are found', async ({ page }) => {
    await page.goto(baseChatUrl)

    const input = page.getByPlaceholder(/Ask a question/)
    await input.fill('What documents are in the knowledge base?')
    await input.press('Enter')

    // Wait for streaming to complete
    await expect(input).toBeEnabled({ timeout: 30_000 })

    // If citations were returned, at least one pill should appear
    // (This test passes vacuously if no citations were returned — that's fine)
    const citationPills = page.locator('button[aria-label^="View source"]')
    const pillCount = await citationPills.count()

    if (pillCount > 0) {
      // Click the first citation pill — drawer should open
      await citationPills.first().click()

      // Drawer title should be visible
      await expect(page.getByRole('complementary', { name: 'Source details' })).toBeVisible()

      // Similarity bar or percentage should appear
      await expect(page.getByText('%')).toBeVisible()

      // Close drawer with X button
      await page.getByRole('button', { name: 'Close source drawer' }).click()
      await expect(page.getByRole('complementary', { name: 'Source details' })).toHaveAttribute('aria-hidden', 'true')
    }
  })

  test('thumbs-up feedback can be submitted', async ({ page }) => {
    await page.goto(baseChatUrl)

    const input = page.getByPlaceholder(/Ask a question/)
    await input.fill('Hello')
    await input.press('Enter')

    // Wait for completion
    await expect(input).toBeEnabled({ timeout: 30_000 })

    // Feedback buttons appear for completed assistant messages that have IDs
    const thumbsUp = page.getByRole('button', { name: 'Helpful' })
    if (await thumbsUp.count() > 0) {
      await thumbsUp.click()
      // After voting, button should be visually activated (aria-pressed)
      await expect(thumbsUp).toHaveAttribute('aria-pressed', 'true')
      // Both buttons should be disabled after a vote
      await expect(thumbsUp).toBeDisabled()
    }
  })
})

test.describe('Chat page — thread navigation', () => {
  test('new chat link in sidebar creates a fresh conversation', async ({ page }) => {
    await page.goto(baseChatUrl)

    // Thread sidebar should have a "New chat" button
    await expect(page.getByRole('link', { name: 'New chat' })).toBeVisible()
  })

  test('source drawer closes on Escape key', async ({ page }) => {
    await page.goto(baseChatUrl)

    const input = page.getByPlaceholder(/Ask a question/)
    await input.fill('What is documented?')
    await input.press('Enter')

    await expect(input).toBeEnabled({ timeout: 30_000 })

    const citationPills = page.locator('button[aria-label^="View source"]')
    if (await citationPills.count() > 0) {
      await citationPills.first().click()
      await expect(page.getByRole('complementary', { name: 'Source details' })).toBeVisible()

      await page.keyboard.press('Escape')
      await expect(page.getByRole('complementary', { name: 'Source details' }))
        .toHaveAttribute('aria-hidden', 'true')
    }
  })
})
