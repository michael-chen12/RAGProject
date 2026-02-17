import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * A single chunk returned from the pgvector similarity search.
 * The `filename` field is joined in from the documents table via the RPC function.
 * `similarity` is a 0-1 cosine similarity score (1 = identical, 0 = unrelated).
 */
export interface RetrievedChunk {
  id: string
  documentId: string
  workspaceId: string
  collectionId: string | null
  chunkText: string
  chunkIndex: number
  similarity: number
  filename: string
}

export interface RetrievalOptions {
  collectionIds?: string[]
  /** Minimum cosine similarity to include. Default: 0.5 */
  threshold?: number
  /** How many chunks to return. Default: 8 */
  k?: number
}

/**
 * Calls the `match_chunks` SECURITY DEFINER RPC to retrieve the top-k most
 * similar document chunks for a given query embedding.
 *
 * IMPORTANT: `workspaceId` MUST come from a validated membership check on the
 * server — never from the raw request body. The RPC enforces workspace isolation
 * in its WHERE clause, but the caller is responsible for passing the correct ID.
 *
 * @param supabase  Service-role client (required for SECURITY DEFINER RPC)
 * @param workspaceId  Validated workspace ID from membership check
 * @param queryEmbedding  1536-dim float array from embedText()
 * @param options  Optional filters and tuning parameters
 */
export async function retrieveChunks(
  supabase: SupabaseClient,
  workspaceId: string,
  queryEmbedding: number[],
  options: RetrievalOptions = {}
): Promise<RetrievedChunk[]> {
  const { collectionIds = [], threshold = 0.5, k = 8 } = options

  const { data, error } = await supabase.rpc('match_chunks', {
    query_embedding: queryEmbedding,
    workspace_id_arg: workspaceId,
    collection_ids: collectionIds,
    match_threshold: threshold,
    match_count: k,
  })

  if (error) {
    throw new Error(`retrieveChunks RPC failed: ${error.message}`)
  }

  // The RPC returns rows without `workspace_id` or `filename`.
  // We denormalize workspace_id from the validated param, and fetch filenames
  // in a second query (batched by document_id).
  const rows = (data ?? []) as Array<{
    id: string
    document_id: string
    collection_id: string | null
    chunk_text: string
    chunk_index: number
    similarity: number
  }>

  if (rows.length === 0) return []

  // Fetch filenames for the distinct document_ids returned
  const documentIds = [...new Set(rows.map((r) => r.document_id))]
  const { data: docs } = await supabase
    .from('documents')
    .select('id, filename')
    .in('id', documentIds)

  const filenameMap = new Map<string, string>(
    (docs ?? []).map((d) => [d.id, d.filename])
  )

  return rows.map((row) => ({
    id: row.id,
    documentId: row.document_id,
    workspaceId,
    collectionId: row.collection_id,
    chunkText: row.chunk_text,
    chunkIndex: row.chunk_index,
    similarity: row.similarity,
    filename: filenameMap.get(row.document_id) ?? 'Unknown document',
  }))
}
