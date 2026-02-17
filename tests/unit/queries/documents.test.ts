/**
 * Unit tests for document query helpers — specifically the three new functions
 * added in TASK-005: getDocumentsByCollection, getUncollectedDocuments, getDocumentChunks.
 */

// ── Mock react cache ──────────────────────────────────────────────────────────
jest.mock('react', () => ({
  cache: (fn: unknown) => fn,
}))

import {
  getDocumentsByCollection,
  getUncollectedDocuments,
  getDocumentChunks,
} from '@/lib/queries/documents'

// ── getDocumentsByCollection ───────────────────────────────────────────────────

describe('getDocumentsByCollection', () => {
  it('queries documents by collection_id and returns them ordered newest first', async () => {
    const fakeDocs = [
      { id: 'd2', filename: 'b.pdf', collection_id: 'c1', created_at: '2024-02-01' },
      { id: 'd1', filename: 'a.pdf', collection_id: 'c1', created_at: '2024-01-01' },
    ]

    const orderSpy = jest.fn().mockReturnValue(Promise.resolve({ data: fakeDocs }))
    const eqSpy = jest.fn().mockReturnValue({ order: orderSpy })

    const mockSupabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({ eq: eqSpy }),
      }),
    }

    const result = await getDocumentsByCollection(mockSupabase as never, 'c1')

    expect(result).toEqual(fakeDocs)
    // Verify the query filters by collection_id
    expect(eqSpy).toHaveBeenCalledWith('collection_id', 'c1')
    // Verify ordering (ascending: false = newest first)
    expect(orderSpy).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('returns empty array when no documents match the collection', async () => {
    const mockSupabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnValue(Promise.resolve({ data: null })),
      }),
    }

    const result = await getDocumentsByCollection(mockSupabase as never, 'non-existent')
    expect(result).toEqual([])
  })
})

// ── getUncollectedDocuments ────────────────────────────────────────────────────

describe('getUncollectedDocuments', () => {
  it('uses .is() with null — NOT .eq() — for the collection_id filter', async () => {
    // This is a critical correctness test:
    // SQL `= NULL` is always FALSE; `IS NULL` works correctly.
    // The implementation MUST call .is('collection_id', null).
    const isSpy = jest.fn().mockReturnThis()
    const eqSpy = jest.fn().mockReturnThis()

    const mockSupabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: eqSpy,
        is: isSpy,
        order: jest.fn().mockReturnValue(Promise.resolve({ data: [] })),
      }),
    }

    await getUncollectedDocuments(mockSupabase as never, 'ws1')

    // .is() must be called with 'collection_id' and null
    expect(isSpy).toHaveBeenCalledWith('collection_id', null)

    // .eq() should NOT be called with 'collection_id' — only with 'workspace_id'
    const collectionEqCalls = eqSpy.mock.calls.filter(([field]) => field === 'collection_id')
    expect(collectionEqCalls).toHaveLength(0)
  })

  it('returns documents with collection_id IS NULL', async () => {
    const fakeDocs = [
      { id: 'd1', filename: 'orphan.pdf', collection_id: null, workspace_id: 'ws1' },
    ]

    const mockSupabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnValue(Promise.resolve({ data: fakeDocs })),
      }),
    }

    const result = await getUncollectedDocuments(mockSupabase as never, 'ws1')
    expect(result).toEqual(fakeDocs)
  })

  it('returns empty array when no uncollected documents exist', async () => {
    const mockSupabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnValue(Promise.resolve({ data: null })),
      }),
    }

    const result = await getUncollectedDocuments(mockSupabase as never, 'ws1')
    expect(result).toEqual([])
  })
})

// ── getDocumentChunks ──────────────────────────────────────────────────────────

describe('getDocumentChunks', () => {
  it('selects only id, chunk_text, token_count, chunk_index — never embedding', async () => {
    // embedding is a 1536-dim vector (~12 KB per chunk) and must never be selected.
    const selectSpy = jest.fn().mockReturnThis()

    const mockSupabase = {
      from: jest.fn().mockReturnValue({
        select: selectSpy,
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnValue(Promise.resolve({ data: [] })),
      }),
    }

    await getDocumentChunks(mockSupabase as never, 'doc1')

    expect(selectSpy).toHaveBeenCalled()
    const selectArg: string = selectSpy.mock.calls[0][0]
    // Must include these fields
    expect(selectArg).toContain('id')
    expect(selectArg).toContain('chunk_text')
    expect(selectArg).toContain('token_count')
    expect(selectArg).toContain('chunk_index')
    // Must NOT select embedding
    expect(selectArg).not.toContain('embedding')
  })

  it('orders chunks by chunk_index ascending (reading order)', async () => {
    const orderSpy = jest.fn().mockReturnValue(Promise.resolve({ data: [] }))

    const mockSupabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnValue({ order: orderSpy }),
      }),
    }

    await getDocumentChunks(mockSupabase as never, 'doc1')

    expect(orderSpy).toHaveBeenCalledWith('chunk_index', { ascending: true })
  })

  it('returns chunks in the order provided by the database', async () => {
    const fakeChunks = [
      { id: 'ch1', chunk_text: 'First chunk', token_count: 10, chunk_index: 0 },
      { id: 'ch2', chunk_text: 'Second chunk', token_count: 12, chunk_index: 1 },
    ]

    const mockSupabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnValue(Promise.resolve({ data: fakeChunks })),
      }),
    }

    const result = await getDocumentChunks(mockSupabase as never, 'doc1')
    expect(result).toEqual(fakeChunks)
  })

  it('returns empty array when document has no chunks', async () => {
    const mockSupabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnValue(Promise.resolve({ data: null })),
      }),
    }

    const result = await getDocumentChunks(mockSupabase as never, 'doc-no-chunks')
    expect(result).toEqual([])
  })
})
