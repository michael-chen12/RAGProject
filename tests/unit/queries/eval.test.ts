/**
 * Unit tests for eval query helpers.
 * Verifies: workspace filtering, set membership, ordering, insert return.
 */

// ── Mock react cache ───────────────────────────────────────────────────────────
jest.mock('react', () => ({
  cache: (fn: unknown) => fn,
}))

// ── Helper to build a chainable Supabase mock ──────────────────────────────────
function makeSupabaseMock(resolveWith: unknown) {
  const chain: Record<string, jest.Mock> = {}
  const methods = ['from', 'select', 'eq', 'order', 'insert', 'single']
  for (const method of methods) {
    chain[method] = jest.fn().mockReturnValue(chain)
  }
  chain['then'] = jest.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolve(resolveWith))
  )
  return chain
}

import { getEvalSets, getEvalCasesForSet, getEvalRunsForSet, insertEvalRun } from '@/lib/queries/eval'

const WORKSPACE_ID = 'ws-test-abc'
const EVAL_SET_ID = 'set-test-123'

// ─────────────────────────────────────────────────────────────────────────────
describe('getEvalSets', () => {
  it('filters by workspace_id and orders newest first', async () => {
    const fakeEvalSets = [
      { id: 'set-2', workspace_id: WORKSPACE_ID, name: 'Set 2', created_at: '2024-02-01' },
      { id: 'set-1', workspace_id: WORKSPACE_ID, name: 'Set 1', created_at: '2024-01-01' },
    ]
    const mock = makeSupabaseMock({ data: fakeEvalSets, error: null })

    const result = await getEvalSets(mock as unknown as Parameters<typeof getEvalSets>[0], WORKSPACE_ID)

    expect(mock.from).toHaveBeenCalledWith('eval_sets')
    expect(mock.eq).toHaveBeenCalledWith('workspace_id', WORKSPACE_ID)
    expect(mock.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(result).toEqual(fakeEvalSets)
  })

  it('returns empty array when no eval sets found', async () => {
    const mock = makeSupabaseMock({ data: null, error: null })

    const result = await getEvalSets(mock as unknown as Parameters<typeof getEvalSets>[0], WORKSPACE_ID)

    expect(result).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('getEvalCasesForSet', () => {
  it('filters by eval_set_id', async () => {
    const fakeCases = [
      { id: 'case-1', eval_set_id: EVAL_SET_ID, question: 'Q1?', expected_answer: 'A1', expected_source_ids: ['chunk-1'] },
      { id: 'case-2', eval_set_id: EVAL_SET_ID, question: 'Q2?', expected_answer: 'A2', expected_source_ids: [] },
    ]
    const mock = makeSupabaseMock({ data: fakeCases, error: null })

    const result = await getEvalCasesForSet(mock as unknown as Parameters<typeof getEvalCasesForSet>[0], EVAL_SET_ID)

    expect(mock.from).toHaveBeenCalledWith('eval_cases')
    expect(mock.eq).toHaveBeenCalledWith('eval_set_id', EVAL_SET_ID)
    expect(result).toEqual(fakeCases)
  })

  it('returns empty array when no cases found', async () => {
    const mock = makeSupabaseMock({ data: null, error: null })

    const result = await getEvalCasesForSet(mock as unknown as Parameters<typeof getEvalCasesForSet>[0], EVAL_SET_ID)

    expect(result).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('getEvalRunsForSet', () => {
  it('filters by eval_set_id and orders newest first', async () => {
    const fakeRuns = [
      { id: 'run-2', eval_set_id: EVAL_SET_ID, recall_at_k: 0.9, answer_accuracy: 0.85, k_value: 5, created_at: '2024-02-01', details: [], hallucination_rate: null },
      { id: 'run-1', eval_set_id: EVAL_SET_ID, recall_at_k: 0.7, answer_accuracy: 0.6, k_value: 5, created_at: '2024-01-01', details: [], hallucination_rate: null },
    ]
    const mock = makeSupabaseMock({ data: fakeRuns, error: null })

    const result = await getEvalRunsForSet(mock as unknown as Parameters<typeof getEvalRunsForSet>[0], EVAL_SET_ID)

    expect(mock.from).toHaveBeenCalledWith('eval_runs')
    expect(mock.eq).toHaveBeenCalledWith('eval_set_id', EVAL_SET_ID)
    expect(mock.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(result).toEqual(fakeRuns)
  })

  it('returns empty array when no runs found', async () => {
    const mock = makeSupabaseMock({ data: null, error: null })

    const result = await getEvalRunsForSet(mock as unknown as Parameters<typeof getEvalRunsForSet>[0], EVAL_SET_ID)

    expect(result).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('insertEvalRun', () => {
  it('inserts and returns the new run', async () => {
    const newRun = {
      id: 'run-new',
      eval_set_id: EVAL_SET_ID,
      recall_at_k: 0.8,
      answer_accuracy: 0.75,
      k_value: 5,
      details: [],
      created_at: '2024-03-01',
      hallucination_rate: null,
    }
    const mock = makeSupabaseMock({ data: newRun, error: null })

    const result = await insertEvalRun(mock as unknown as Parameters<typeof insertEvalRun>[0], {
      eval_set_id: EVAL_SET_ID,
      recall_at_k: 0.8,
      answer_accuracy: 0.75,
      k_value: 5,
      details: [],
    })

    expect(mock.from).toHaveBeenCalledWith('eval_runs')
    expect(mock.insert).toHaveBeenCalledWith({
      eval_set_id: EVAL_SET_ID,
      recall_at_k: 0.8,
      answer_accuracy: 0.75,
      k_value: 5,
      details: [],
    })
    expect(mock.single).toHaveBeenCalled()
    expect(result).toEqual(newRun)
  })
})
