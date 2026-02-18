/**
 * Unit tests for the eval runner logic.
 * Verifies: recall hit detection, LLM-judge scoring, malformed JSON fallback.
 */

// ── Mocks must be defined before imports ──────────────────────────────────────
const mockEmbedText = jest.fn()
const mockRetrieveChunks = jest.fn()
const mockCreate = jest.fn()
const mockStreamChatResponse = jest.fn()

jest.mock('@/lib/openai/embeddings', () => ({
  embedText: (...args: unknown[]) => mockEmbedText(...args),
}))

jest.mock('@/lib/rag/retrieval', () => ({
  retrieveChunks: (...args: unknown[]) => mockRetrieveChunks(...args),
}))

jest.mock('openai', () => {
  return {
    __esModule: true,
    default: class MockOpenAI {
      chat = {
        completions: {
          create: (...args: unknown[]) => mockCreate(...args),
        },
      }
    },
  }
})

jest.mock('@/lib/openai/chat', () => ({
  streamChatResponse: (...args: unknown[]) => mockStreamChatResponse(...args),
}))

jest.mock('@/lib/rag/prompt', () => ({
  buildSystemPrompt: jest.fn().mockReturnValue({
    systemPrompt: 'Test system prompt',
    citationMap: [],
  }),
}))

import { runEvalCase } from '@/lib/eval/runner'

// Helper to create a simple readable stream for testing
function createMockStream(text: string) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(text)
      controller.close()
    },
  })
}

describe('runEvalCase', () => {
  const supabase = {} as Parameters<typeof runEvalCase>[0]
  const workspaceId = 'ws-1'

  beforeEach(() => {
    jest.clearAllMocks()
    mockStreamChatResponse.mockResolvedValue(createMockStream('Generated answer text'))
  })

  it('returns recall hit=true when expected_source_id appears in retrieved chunks', async () => {
    mockEmbedText.mockResolvedValue(new Array(1536).fill(0.1))
    mockRetrieveChunks.mockResolvedValue([
      { id: 'chunk-abc', chunkText: 'Refunds within 30 days', similarity: 0.9, documentId: 'doc-1', workspaceId: 'ws-1', collectionId: null, chunkIndex: 0, filename: 'policy.md' },
    ])
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '{"score": 0.9}' } }],
    })

    const result = await runEvalCase(supabase, workspaceId, {
      id: 'case-1',
      question: 'What is the refund policy?',
      expected_answer: 'Refunds within 30 days',
      expected_source_ids: ['chunk-abc'],
      eval_set_id: 'set-1',
    })

    expect(result.recallHit).toBe(true)
    expect(result.llmScore).toBeCloseTo(0.9)
    expect(result.retrievedChunkIds).toContain('chunk-abc')
  })

  it('returns recall hit=false when expected_source_id is NOT in retrieved chunks', async () => {
    mockEmbedText.mockResolvedValue(new Array(1536).fill(0.1))
    mockRetrieveChunks.mockResolvedValue([
      { id: 'chunk-xyz', chunkText: 'Something else', similarity: 0.7, documentId: 'doc-2', workspaceId: 'ws-1', collectionId: null, chunkIndex: 0, filename: 'other.md' },
    ])
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '{"score": 0.2}' } }],
    })

    const result = await runEvalCase(supabase, workspaceId, {
      id: 'case-2',
      question: 'What is the refund policy?',
      expected_answer: 'Refunds within 30 days',
      expected_source_ids: ['chunk-abc'],
      eval_set_id: 'set-1',
    })

    expect(result.recallHit).toBe(false)
    expect(result.llmScore).toBeCloseTo(0.2)
  })

  it('handles malformed LLM judge response by defaulting score to 0', async () => {
    mockEmbedText.mockResolvedValue(new Array(1536).fill(0))
    mockRetrieveChunks.mockResolvedValue([])
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'not json' } }],
    })

    const result = await runEvalCase(supabase, workspaceId, {
      id: 'case-3',
      question: 'Q?',
      expected_answer: 'A',
      expected_source_ids: [],
      eval_set_id: 'set-1',
    })

    expect(result.llmScore).toBe(0)
  })

  it('returns recall hit=false when expected_source_ids is empty', async () => {
    mockEmbedText.mockResolvedValue(new Array(1536).fill(0.1))
    mockRetrieveChunks.mockResolvedValue([
      { id: 'chunk-xyz', chunkText: 'Some content', similarity: 0.8, documentId: 'doc-1', workspaceId: 'ws-1', collectionId: null, chunkIndex: 0, filename: 'doc.md' },
    ])
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '{"score": 0.5}' } }],
    })

    const result = await runEvalCase(supabase, workspaceId, {
      id: 'case-4',
      question: 'Generic question',
      expected_answer: 'Generic answer',
      expected_source_ids: [],
      eval_set_id: 'set-1',
    })

    // With no expected sources, recall is always false (nothing to match)
    expect(result.recallHit).toBe(false)
  })

  it('clamps LLM score to 0-1 range', async () => {
    mockEmbedText.mockResolvedValue(new Array(1536).fill(0.1))
    mockRetrieveChunks.mockResolvedValue([])
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '{"score": 1.5}' } }],
    })

    const result = await runEvalCase(supabase, workspaceId, {
      id: 'case-5',
      question: 'Q?',
      expected_answer: 'A',
      expected_source_ids: [],
      eval_set_id: 'set-1',
    })

    expect(result.llmScore).toBe(1) // Clamped to max 1
  })
})
