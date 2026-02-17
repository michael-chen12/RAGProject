import { test, expect } from '@playwright/test'

/**
 * E2E tests for the Knowledge Base management UI.
 *
 * Prerequisites:
 *   - Local dev server running (playwright config starts it via webServer)
 *   - A seeded test workspace with at least one collection and one indexed document
 *   - TEST_WORKSPACE_ID env var pointing to that workspace
 *   - Valid session cookies (authenticate before running, or use storageState)
 *
 * These tests are written as acceptance tests — they verify the user-visible
 * behaviour described in the TASK-005 acceptance criteria.
 */

const workspaceId = process.env.TEST_WORKSPACE_ID ?? 'test-workspace'
const baseKbUrl = `/${workspaceId}/kb`

// ── KB Overview ───────────────────────────────────────────────────────────────

test.describe('KB Overview (/kb)', () => {
  test('renders the Knowledge Base page with collections grid', async ({ page }) => {
    await page.goto(baseKbUrl)

    // The page heading must be present
    await expect(page.getByRole('heading', { name: 'Knowledge Base' })).toBeVisible()
  })

  test('displays collection cards in the grid', async ({ page }) => {
    await page.goto(baseKbUrl)

    // There should be at least one link going to a collection URL
    // Collections are rendered as <Link> elements pointing to /kb/[collectionId]
    const collectionLinks = page.locator(`a[href^="/${workspaceId}/kb/"]`).filter({
      hasNot: page.locator(`a[href="/${workspaceId}/kb/upload"]`),
    })
    await expect(collectionLinks.first()).toBeVisible({ timeout: 10_000 })
  })
})

// ── Collection Page ───────────────────────────────────────────────────────────

test.describe('Collection Page (/kb/[collectionId])', () => {
  test('clicking a collection card navigates to the document list', async ({ page }) => {
    await page.goto(baseKbUrl)

    // Find and click the first collection link
    const firstCollection = page
      .locator(`a[href^="/${workspaceId}/kb/"]`)
      .filter({ hasNot: page.locator(`a[href="/${workspaceId}/kb/upload"]`) })
      .first()

    const href = await firstCollection.getAttribute('href')
    await firstCollection.click()

    // Should navigate to the collection page
    await expect(page).toHaveURL(new RegExp(`${workspaceId}/kb/`))

    // The document table or empty state should be present
    const hasTable = await page.locator('table').isVisible().catch(() => false)
    const hasEmptyState = await page
      .getByText('No documents in this collection yet')
      .isVisible()
      .catch(() => false)
    expect(hasTable || hasEmptyState).toBe(true)
  })

  test('displays status badges for documents', async ({ page }) => {
    await page.goto(baseKbUrl)

    // Navigate to the first collection
    const firstCollection = page
      .locator(`a[href^="/${workspaceId}/kb/"]`)
      .filter({ hasNot: page.locator(`a[href="/${workspaceId}/kb/upload"]`) })
      .first()

    await firstCollection.click()
    await page.waitForURL(`**/${workspaceId}/kb/**`)

    // If there are documents, at least one status badge should be visible
    const hasDocuments = await page.locator('table').isVisible().catch(() => false)
    if (hasDocuments) {
      // Status badges have one of these texts
      const badge = page
        .locator('span')
        .filter({ hasText: /Indexed|Indexing|Failed/i })
        .first()
      await expect(badge).toBeVisible()
    }
  })
})

// ── Document Detail Page ──────────────────────────────────────────────────────

test.describe('Document Detail Page (/kb/document/[documentId])', () => {
  test('clicking an indexed document navigates to the detail page with chunk viewer', async ({
    page,
  }) => {
    await page.goto(baseKbUrl)

    // Navigate to first collection
    const firstCollection = page
      .locator(`a[href^="/${workspaceId}/kb/"]`)
      .filter({ hasNot: page.locator(`a[href="/${workspaceId}/kb/upload"]`) })
      .first()
    await firstCollection.click()
    await page.waitForURL(`**/${workspaceId}/kb/**`)

    // Find a link to a document detail page (/kb/document/...)
    const documentLink = page
      .locator(`a[href*="/${workspaceId}/kb/document/"]`)
      .first()

    const hasDocument = await documentLink.isVisible().catch(() => false)
    if (!hasDocument) {
      test.skip() // No documents available — skip
      return
    }

    await documentLink.click()
    await page.waitForURL(`**/${workspaceId}/kb/document/**`)

    // The chunk viewer should be present for indexed documents
    const isIndexed = await page.getByText('Indexed').isVisible().catch(() => false)
    if (isIndexed) {
      // ChunkViewer has aria-label "Chunk list — N chunks"
      const chunkViewer = page.locator('[aria-label*="Chunk list"]')
      await expect(chunkViewer).toBeVisible({ timeout: 5_000 })
    }
  })

  test('chunk viewer uses virtualization — DOM nodes stay bounded', async ({ page }) => {
    await page.goto(baseKbUrl)

    // Navigate to an indexed document if available
    const firstCollection = page
      .locator(`a[href^="/${workspaceId}/kb/"]`)
      .filter({ hasNot: page.locator(`a[href="/${workspaceId}/kb/upload"]`) })
      .first()
    await firstCollection.click()
    await page.waitForURL(`**/${workspaceId}/kb/**`)

    const documentLink = page
      .locator(`a[href*="/${workspaceId}/kb/document/"]`)
      .first()
    const hasDocument = await documentLink.isVisible().catch(() => false)
    if (!hasDocument) {
      test.skip()
      return
    }

    await documentLink.click()
    await page.waitForURL(`**/${workspaceId}/kb/document/**`)

    const chunkViewer = page.locator('[aria-label*="Chunk list"]')
    const isVisible = await chunkViewer.isVisible().catch(() => false)
    if (!isVisible) return // Not indexed, skip virtualization check

    // Count rendered DOM nodes inside the chunk viewer
    // Virtualization should render only ~20 rows regardless of chunk count
    const visibleChunkCount = await chunkViewer.locator('[data-index]').count()
    expect(visibleChunkCount).toBeLessThan(30)
  })
})

// ── RBAC: Viewer redirect ──────────────────────────────────────────────────────

test.describe('RBAC — viewer cannot access private collections', () => {
  test('viewer navigating to a private collection URL is redirected to /kb', async ({
    page,
  }) => {
    // This test requires a known private collection ID and a viewer session.
    // In CI, set PRIVATE_COLLECTION_ID env var with a seeded private collection.
    const privateCollectionId = process.env.PRIVATE_COLLECTION_ID
    if (!privateCollectionId) {
      test.skip() // Only run when env is available
      return
    }

    await page.goto(`/${workspaceId}/kb/${privateCollectionId}`)

    // Should redirect to the KB overview
    await expect(page).toHaveURL(`/${workspaceId}/kb`)
  })
})

// ── Admin: Create collection ───────────────────────────────────────────────────

test.describe('Admin — create collection', () => {
  test('clicking New Collection opens a modal and creates a collection', async ({ page }) => {
    await page.goto(baseKbUrl)

    // The "New Collection" button is only shown to admin/agent
    const newCollectionBtn = page.getByRole('button', { name: 'New Collection' })
    const isVisible = await newCollectionBtn.isVisible().catch(() => false)

    if (!isVisible) {
      test.skip() // Viewer role — skip
      return
    }

    await newCollectionBtn.click()

    // Modal should appear
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByLabelText('Name')).toBeVisible()

    // Fill in the name and submit
    await page.getByLabelText('Name').fill('E2E Test Collection')
    await page.getByRole('button', { name: 'Create Collection' }).click()

    // Modal closes and new collection appears in the grid
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('E2E Test Collection')).toBeVisible()
  })
})
