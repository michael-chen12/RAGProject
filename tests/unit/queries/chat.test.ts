/**
 * Unit tests for chat query helpers.
 * Verifies: privacy filtering (userId + workspaceId), ordering, empty results.
 */

// ── Mock react cache ──────────────────────────────────────────────────────────
jest.mock('react', () => ({
  cache: (fn: unknown) => fn,
}))

// ── Helper to build chainable Supabase mock ───────────────────────────────────
function makeSupabaseMock(resolveWith: unknown) {
  const chain: Record<string, jest.Mock> = {}
  const methods = ['from', 'select', 'eq', 'order', 'single']
  for (const method of methods) {
    chain[method] = jest.fn().mockReturnValue(chain)
  }
  chain['then'] = jest.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolve(resolveWith))
  )
  return chain
}

import { getThread, getThreads, getChatMessages } from '@/lib/queries/chat'

const USER_ID = 'user-test-abc'
const WORKSPACE_ID = 'ws-test-abc'
const THREAD_ID = 'thread-test-abc'

describe('getThread', () => {
  it('filters by threadId, userId, AND workspaceId', async () => {
    const fakeThread = { id: THREAD_ID, user_id: USER_ID, workspace_id: WORKSPACE_ID, title: 'Test', created_at: '2024-01-01' }
    const mock = makeSupabaseMock({ data: fakeThread })

    const result = await getThread(mock as unknown as Parameters<typeof getThread>[0], THREAD_ID, USER_ID, WORKSPACE_ID)

    expect(mock.from).toHaveBeenCalledWith('chat_threads')
    // Verify all three equality filters are applied
    expect(mock.eq).toHaveBeenCalledWith('id', THREAD_ID)
    expect(mock.eq).toHaveBeenCalledWith('user_id', USER_ID)
    expect(mock.eq).toHaveBeenCalledWith('workspace_id', WORKSPACE_ID)
    expect(result).toEqual(fakeThread)
  })

  it('returns null when thread not found', async () => {
    const mock = makeSupabaseMock({ data: null })

    const result = await getThread(mock as unknown as Parameters<typeof getThread>[0], THREAD_ID, USER_ID, WORKSPACE_ID)

    expect(result).toBeNull()
  })
})

describe('getThreads', () => {
  it('filters by userId AND workspaceId', async () => {
    const fakeThreads = [
      { id: 'thread-1', user_id: USER_ID, workspace_id: WORKSPACE_ID, title: 'Chat 1', created_at: '2024-01-02' },
      { id: 'thread-2', user_id: USER_ID, workspace_id: WORKSPACE_ID, title: 'Chat 2', created_at: '2024-01-01' },
    ]
    const mock = makeSupabaseMock({ data: fakeThreads })

    const result = await getThreads(mock as unknown as Parameters<typeof getThreads>[0], USER_ID, WORKSPACE_ID)

    expect(mock.from).toHaveBeenCalledWith('chat_threads')
    expect(mock.eq).toHaveBeenCalledWith('user_id', USER_ID)
    expect(mock.eq).toHaveBeenCalledWith('workspace_id', WORKSPACE_ID)
    expect(mock.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(result).toEqual(fakeThreads)
  })

  it('returns empty array when no threads found', async () => {
    const mock = makeSupabaseMock({ data: null })

    const result = await getThreads(mock as unknown as Parameters<typeof getThreads>[0], USER_ID, WORKSPACE_ID)

    expect(result).toEqual([])
  })
})

describe('getChatMessages', () => {
  it('returns empty array when thread not found (cross-user access prevented)', async () => {
    // Simulate thread ownership check failing — data: null
    const mock = makeSupabaseMock({ data: null })

    const result = await getChatMessages(
      mock as unknown as Parameters<typeof getChatMessages>[0],
      THREAD_ID,
      'different-user',
      WORKSPACE_ID
    )

    // Should return empty without querying chat_messages
    expect(result).toEqual([])
  })

  it('returns messages ordered chronologically when thread is owned by user', async () => {
    const fakeThread = { id: THREAD_ID, user_id: USER_ID, workspace_id: WORKSPACE_ID, title: 'Test', created_at: '2024-01-01' }
    const fakeMessages = [
      { id: 'msg-1', thread_id: THREAD_ID, role: 'user', content: 'Hello', citations: null, created_at: '2024-01-01T10:00:00Z' },
      { id: 'msg-2', thread_id: THREAD_ID, role: 'assistant', content: 'Hi there', citations: null, created_at: '2024-01-01T10:00:05Z' },
    ]

    // The mock needs to handle two sequential queries (getThread + chat_messages)
    // We simulate this by returning different values on consecutive calls
    let callCount = 0
    const chain: Record<string, jest.Mock> = {}
    const methods = ['from', 'select', 'eq', 'order', 'single']
    for (const method of methods) {
      chain[method] = jest.fn().mockReturnValue(chain)
    }
    chain['then'] = jest.fn().mockImplementation((resolve: (v: unknown) => unknown) => {
      callCount++
      // First call: getThread; second call: chat_messages
      const data = callCount === 1 ? fakeThread : fakeMessages
      return Promise.resolve(resolve({ data }))
    })

    const result = await getChatMessages(
      chain as unknown as Parameters<typeof getChatMessages>[0],
      THREAD_ID,
      USER_ID,
      WORKSPACE_ID
    )

    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: true })
    expect(result).toHaveLength(2)
    expect(result[0].role).toBe('user')
    expect(result[1].role).toBe('assistant')
  })
})
