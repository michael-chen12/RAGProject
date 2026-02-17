import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Tables } from '@/types/database.types'

type Document = Tables<'documents'>

// Only the fields needed for the chunk viewer — NEVER select 'embedding'
// (1536-dim vector ≈ 12 KB per chunk; would blow up payload for large docs)
export type DocumentChunk = Pick<
  Tables<'document_chunks'>,
  'id' | 'chunk_text' | 'token_count' | 'chunk_index'
>

/**
 * Fetches a single document by ID.
 * RLS on `documents` ensures the caller can only see rows in their workspace.
 * Wrapped in cache() to deduplicate calls within a single request.
 */
export const getDocument = cache(
  async (supabase: SupabaseClient, id: string): Promise<Document | null> => {
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single()

    return data ?? null
  }
)

/**
 * Fetches all documents in a workspace, ordered newest first.
 */
export const getDocumentsByWorkspace = cache(
  async (supabase: SupabaseClient, workspaceId: string): Promise<Document[]> => {
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    return data ?? []
  }
)

/**
 * Fetches all documents belonging to a specific collection, newest first.
 */
export const getDocumentsByCollection = cache(
  async (supabase: SupabaseClient, collectionId: string): Promise<Document[]> => {
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('collection_id', collectionId)
      .order('created_at', { ascending: false })

    return data ?? []
  }
)

/**
 * Fetches documents that are not assigned to any collection (collection_id IS NULL).
 * Uses .is() — critical: .eq('collection_id', null) generates '= NULL' which is
 * always FALSE in SQL. .is() generates 'IS NULL' which works correctly.
 */
export const getUncollectedDocuments = cache(
  async (supabase: SupabaseClient, workspaceId: string): Promise<Document[]> => {
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('workspace_id', workspaceId)
      .is('collection_id', null)
      .order('created_at', { ascending: false })

    return data ?? []
  }
)

/**
 * Fetches all chunks for a document, ordered by chunk_index (reading order).
 * Deliberately excludes the 'embedding' column — it's a 1536-dim vector
 * that adds ~12 KB per chunk and is never needed for display.
 */
export const getDocumentChunks = cache(
  async (supabase: SupabaseClient, documentId: string): Promise<DocumentChunk[]> => {
    const { data } = await supabase
      .from('document_chunks')
      .select('id, chunk_text, token_count, chunk_index')
      .eq('document_id', documentId)
      .order('chunk_index', { ascending: true })

    return data ?? []
  }
)
