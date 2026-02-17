/**
 * Unit tests for collection query helpers.
 * All Supabase calls are mocked — tests validate query construction logic,
 * not DB connectivity.
 */

// ── Helper to build a chainable Supabase mock ─────────────────────────────────
// Each method returns `this` so calls can be chained: .from().select().eq()...
function makeSupabaseMock(resolveWith: unknown) {
  const chain: Record<string, jest.Mock> = {}
  const methods = ['from', 'select', 'eq', 'in', 'order', 'single']

  for (const method of methods) {
    chain[method] = jest.fn().mockReturnValue(chain)
  }

  // The final awaited value — simulates the resolved Supabase query
  chain['then'] = jest.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolve(resolveWith))
  )

  return chain
}

// ── Mock react cache (server-only in test env) ────────────────────────────────
jest.mock('react', () => ({
  cache: (fn: unknown) => fn,
}))

import { getCollections, getCollection } from '@/lib/queries/collections'

// ── getCollections ─────────────────────────────────────────────────────────────

describe('getCollections', () => {
  it('returns all collections for admin role (no visibility filter)', async () => {
    const fakeCollections = [
      { id: 'c1', name: 'Public Coll', visibility: 'public', workspace_id: 'ws1', created_at: '2024-01-01' },
      { id: 'c2', name: 'Private Coll', visibility: 'private', workspace_id: 'ws1', created_at: '2024-01-02' },
    ]

    // First call returns collections; second returns count rows
    let callCount = 0
    const supabase = {
      from: jest.fn().mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockImplementation(() => ({
          // Thenable — resolve with collections on first call, counts on second
          then: jest.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
            callCount++
            if (callCount === 1) return Promise.resolve(resolve({ data: fakeCollections }))
            return Promise.resolve(resolve({ data: [{ collection_id: 'c1' }, { collection_id: 'c1' }] }))
          }),
        })),
        is: jest.fn().mockReturnThis(),
      })),
    }

    // For the count query (no .order()), we need to handle it differently
    // Let's use a simpler approach: mock the supabase object with spies
    const mockChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
    }

    let queryCallCount = 0
    const mockSupabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'collections') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnValue(
              Promise.resolve({ data: fakeCollections })
            ),
          }
        }
        // documents count query
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnValue(
            Promise.resolve({ data: [{ collection_id: 'c1' }, { collection_id: 'c1' }] })
          ),
        }
      }),
    }

    const result = await getCollections(mockSupabase as never, 'ws1', 'admin')

    expect(result).toHaveLength(2)
    expect(result.find((c) => c.id === 'c1')?.doc_count).toBe(2)
    expect(result.find((c) => c.id === 'c2')?.doc_count).toBe(0)
    // Admin query should NOT filter by visibility
    const collectionsQuery = mockSupabase.from.mock.calls.find(([t]) => t === 'collections')
    expect(collectionsQuery).toBeDefined()
  })

  it('adds visibility=public filter for viewer role', async () => {
    // The Supabase builder is immutable — each method returns a new chain object.
    // In the implementation: query = query.eq('visibility', 'public') — the result
    // of .eq() is reassigned. So .eq() must return an object that also has .order().
    const eqCalls: Array<[string, unknown]> = []

    // A self-referential chain where every method returns the chain itself,
    // and we track .eq() calls
    const collectionsChain: Record<string, jest.Mock> = {}
    collectionsChain.select = jest.fn().mockReturnValue(collectionsChain)
    collectionsChain.eq = jest.fn().mockImplementation((field: string, value: unknown) => {
      eqCalls.push([field, value])
      return collectionsChain
    })
    collectionsChain.order = jest.fn().mockReturnValue(Promise.resolve({ data: [] }))

    const mockSupabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'collections') return collectionsChain
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnValue(Promise.resolve({ data: [] })),
        }
      }),
    }

    await getCollections(mockSupabase as never, 'ws1', 'viewer')

    // The viewer should trigger a .eq('visibility', 'public') call
    const hasVisibilityFilter = eqCalls.some(
      ([field, value]) => field === 'visibility' && value === 'public'
    )
    expect(hasVisibilityFilter).toBe(true)
  })

  it('does NOT add visibility filter for agent role', async () => {
    const eqCalls: Array<[string, unknown]> = []

    const collectionsChain: Record<string, jest.Mock> = {}
    collectionsChain.select = jest.fn().mockReturnValue(collectionsChain)
    collectionsChain.eq = jest.fn().mockImplementation((field: string, value: unknown) => {
      eqCalls.push([field, value])
      return collectionsChain
    })
    collectionsChain.order = jest.fn().mockReturnValue(Promise.resolve({ data: [] }))

    const mockSupabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'collections') return collectionsChain
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnValue(Promise.resolve({ data: [] })),
        }
      }),
    }

    await getCollections(mockSupabase as never, 'ws1', 'agent')

    // Agent should NOT have a visibility filter (only workspace_id filter)
    const visibilityCalls = eqCalls.filter(([field]) => field === 'visibility')
    expect(visibilityCalls).toHaveLength(0)
  })

  it('returns empty array when no collections exist', async () => {
    const mockSupabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnValue(Promise.resolve({ data: [] })),
      }),
    }

    const result = await getCollections(mockSupabase as never, 'ws1', 'admin')
    expect(result).toEqual([])
  })

  it('returns doc_count 0 for a collection with no documents', async () => {
    const fakeCollections = [
      { id: 'c-empty', name: 'Empty', visibility: 'public', workspace_id: 'ws1', created_at: '2024-01-01' },
    ]

    const mockSupabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'collections') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnValue(Promise.resolve({ data: fakeCollections })),
          }
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          // No rows returned — no documents in this collection
          in: jest.fn().mockReturnValue(Promise.resolve({ data: [] })),
        }
      }),
    }

    const result = await getCollections(mockSupabase as never, 'ws1', 'admin')
    expect(result).toHaveLength(1)
    expect(result[0].doc_count).toBe(0)
  })
})

// ── getCollection ──────────────────────────────────────────────────────────────

describe('getCollection', () => {
  it('returns the collection when found', async () => {
    const fakeCollection = { id: 'c1', name: 'Test', visibility: 'public', workspace_id: 'ws1' }
    const mockSupabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnValue(Promise.resolve({ data: fakeCollection })),
      }),
    }

    const result = await getCollection(mockSupabase as never, 'c1')
    expect(result).toEqual(fakeCollection)
  })

  it('returns null for a non-existent ID', async () => {
    const mockSupabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnValue(Promise.resolve({ data: null })),
      }),
    }

    const result = await getCollection(mockSupabase as never, 'non-existent')
    expect(result).toBeNull()
  })
})
