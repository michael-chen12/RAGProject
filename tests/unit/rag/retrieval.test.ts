/**
 * Unit tests for the RAG retrieval helper.
 * Mocks the Supabase RPC call and documents query.
 * Verifies: correct RPC params, workspaceId propagation, filename joining, empty result.
 */

const mockRpc = jest.fn()
const mockFrom = jest.fn()

// Build a chainable mock for supabase.from().select().in()
function makeFromChain(resolveWith: unknown) {
  const chain: Record<string, jest.Mock> = {}
  const methods = ['select', 'in', 'eq']
  for (const method of methods) {
    chain[method] = jest.fn().mockReturnValue(chain)
  }
  chain['then'] = jest.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolve(resolveWith))
  )
  return chain
}

import { retrieveChunks } from '@/lib/rag/retrieval'

const WORKSPACE_ID = 'ws-test-123'
const FAKE_EMBEDDING = new Array(1536).fill(0.1)

describe('retrieveChunks', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('calls match_chunks RPC with correct parameters', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null })
    mockFrom.mockReturnValue(makeFromChain({ data: [] }))

    const supabase = { rpc: mockRpc, from: mockFrom } as unknown as Parameters<typeof retrieveChunks>[0]

    await retrieveChunks(supabase, WORKSPACE_ID, FAKE_EMBEDDING, {
      k: 5,
      threshold: 0.6,
      collectionIds: ['col-1'],
    })

    expect(mockRpc).toHaveBeenCalledWith('match_chunks', {
      query_embedding: FAKE_EMBEDDING,
      workspace_id_arg: WORKSPACE_ID,
      collection_ids: ['col-1'],
      match_threshold: 0.6,
      match_count: 5,
    })
  })

  it('uses default options when none provided', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null })
    mockFrom.mockReturnValue(makeFromChain({ data: [] }))

    const supabase = { rpc: mockRpc, from: mockFrom } as unknown as Parameters<typeof retrieveChunks>[0]

    await retrieveChunks(supabase, WORKSPACE_ID, FAKE_EMBEDDING)

    expect(mockRpc).toHaveBeenCalledWith('match_chunks', expect.objectContaining({
      collection_ids: [],
      match_threshold: 0.5,
      match_count: 8,
    }))
  })

  it('returns empty array when RPC returns no rows', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null })

    const supabase = { rpc: mockRpc, from: mockFrom } as unknown as Parameters<typeof retrieveChunks>[0]

    const result = await retrieveChunks(supabase, WORKSPACE_ID, FAKE_EMBEDDING)
    expect(result).toEqual([])
    // Should NOT query documents table when no chunks returned
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('maps RPC rows to RetrievedChunk shape with filenames', async () => {
    const rpcRows = [
      {
        id: 'chunk-1',
        document_id: 'doc-1',
        collection_id: 'col-1',
        chunk_text: 'Hello world',
        chunk_index: 0,
        similarity: 0.87,
      },
    ]
    mockRpc.mockResolvedValue({ data: rpcRows, error: null })
    mockFrom.mockReturnValue(makeFromChain({
      data: [{ id: 'doc-1', filename: 'manual.pdf' }],
    }))

    const supabase = { rpc: mockRpc, from: mockFrom } as unknown as Parameters<typeof retrieveChunks>[0]

    const result = await retrieveChunks(supabase, WORKSPACE_ID, FAKE_EMBEDDING)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'chunk-1',
      documentId: 'doc-1',
      workspaceId: WORKSPACE_ID,
      collectionId: 'col-1',
      chunkText: 'Hello world',
      chunkIndex: 0,
      similarity: 0.87,
      filename: 'manual.pdf',
    })
  })

  it('uses "Unknown document" when filename is not found', async () => {
    const rpcRows = [
      {
        id: 'chunk-2',
        document_id: 'doc-missing',
        collection_id: null,
        chunk_text: 'Some text',
        chunk_index: 1,
        similarity: 0.72,
      },
    ]
    mockRpc.mockResolvedValue({ data: rpcRows, error: null })
    // Documents query returns no rows for this doc_id
    mockFrom.mockReturnValue(makeFromChain({ data: [] }))

    const supabase = { rpc: mockRpc, from: mockFrom } as unknown as Parameters<typeof retrieveChunks>[0]

    const result = await retrieveChunks(supabase, WORKSPACE_ID, FAKE_EMBEDDING)

    expect(result[0].filename).toBe('Unknown document')
  })

  it('throws an error when RPC returns an error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'pgvector not available' } })

    const supabase = { rpc: mockRpc, from: mockFrom } as unknown as Parameters<typeof retrieveChunks>[0]

    await expect(
      retrieveChunks(supabase, WORKSPACE_ID, FAKE_EMBEDDING)
    ).rejects.toThrow('pgvector not available')
  })
})
