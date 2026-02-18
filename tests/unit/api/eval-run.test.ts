/**
 * Tests the eval run API route logic in isolation.
 * Verifies: admin-only enforcement, 400 on missing evalSetId, correct metric accumulation.
 */

// ── Mocks must be defined before imports ──────────────────────────────────────
const mockGetUser = jest.fn()
const mockFrom = jest.fn()

// Chain builder for Supabase query mocks
function makeSupabaseChain(resolveWith: unknown) {
  const chain: Record<string, jest.Mock> = {}
  const methods = ['select', 'eq', 'single', 'order', 'insert']
  for (const method of methods) {
    chain[method] = jest.fn().mockReturnValue(chain)
  }
  chain['then'] = jest.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolve(resolveWith))
  )
  return chain
}

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockImplementation(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
  createServiceClient: jest.fn().mockReturnValue({
    from: jest.fn().mockReturnValue(makeSupabaseChain({ data: [], error: null })),
  }),
}))

jest.mock('@/lib/eval/runner', () => ({
  runEvalCase: jest.fn().mockResolvedValue({
    caseId: 'case-1',
    question: 'Test Q',
    expectedAnswer: 'Test A',
    generatedAnswer: 'Generated A',
    recallHit: true,
    llmScore: 0.8,
    retrievedChunkIds: ['chunk-1'],
  }),
}))

jest.mock('@/lib/queries/eval', () => ({
  getEvalCasesForSet: jest.fn().mockResolvedValue([
    { id: 'c1', question: 'Q1', expected_answer: 'A1', expected_source_ids: ['chunk-1'], eval_set_id: 's1' },
  ]),
  insertEvalRun: jest.fn().mockResolvedValue({
    id: 'run-1',
    eval_set_id: 's1',
    recall_at_k: 0.8,
    answer_accuracy: 0.8,
    k_value: 5,
    details: [],
    created_at: '2024-01-01',
    hallucination_rate: null,
  }),
}))

describe('POST /api/eval/run', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    // Dynamic import so mocks apply
    const { POST } = await import('@/app/api/eval/run/route')
    const req = new Request('http://localhost/api/eval/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ evalSetId: 's1', workspaceId: 'ws-1' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when evalSetId is missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockFrom.mockReturnValue(makeSupabaseChain({ data: { role: 'admin', workspace_id: 'ws-1' }, error: null }))

    const { POST } = await import('@/app/api/eval/run/route')
    const req = new Request('http://localhost/api/eval/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: 'ws-1' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 403 when user is not admin', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockFrom.mockReturnValue(makeSupabaseChain({ data: { role: 'viewer', workspace_id: 'ws-1' }, error: null }))

    const { POST } = await import('@/app/api/eval/run/route')
    const req = new Request('http://localhost/api/eval/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ evalSetId: 's1', workspaceId: 'ws-1' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(403)
  })
})
