import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Tables, Enums } from '@/types/database.types'

type Collection = Tables<'collections'>
type MemberRole = Enums<'member_role'>

export type CollectionWithCount = Collection & { doc_count: number }

/**
 * Fetches all collections in a workspace, ordered newest first.
 * Applies an app-layer visibility filter for viewers: they can only see
 * public collections. RLS does NOT filter by visibility — this is deliberate
 * so that admins/agents can manage private collections.
 *
 * Uses a separate count query to avoid Supabase count() type gymnastics.
 */
export const getCollections = cache(
  async (
    supabase: SupabaseClient,
    workspaceId: string,
    role: MemberRole
  ): Promise<CollectionWithCount[]> => {
    // Build query — apply viewer visibility filter BEFORE .order()
    // Supabase builder methods return new objects; filters must be added before the terminal call
    let query = supabase
      .from('collections')
      .select('*')
      .eq('workspace_id', workspaceId)

    // Viewers only see public collections (app-layer filter, not RLS)
    if (role === 'viewer') {
      query = query.eq('visibility', 'public')
    }

    const { data: collections } = await query.order('created_at', { ascending: false })

    if (!collections || collections.length === 0) return []

    // Separate count query to get document counts per collection
    const { data: countRows } = await supabase
      .from('documents')
      .select('collection_id')
      .eq('workspace_id', workspaceId)
      .in(
        'collection_id',
        collections.map((c) => c.id)
      )

    const countMap: Record<string, number> = {}
    for (const row of countRows ?? []) {
      if (row.collection_id) {
        countMap[row.collection_id] = (countMap[row.collection_id] ?? 0) + 1
      }
    }

    return collections.map((c) => ({ ...c, doc_count: countMap[c.id] ?? 0 }))
  }
)

/**
 * Fetches a single collection by ID.
 * RLS ensures the caller can only see collections in their workspace.
 */
export const getCollection = cache(
  async (supabase: SupabaseClient, collectionId: string): Promise<Collection | null> => {
    const { data } = await supabase
      .from('collections')
      .select('*')
      .eq('id', collectionId)
      .single()

    return data ?? null
  }
)
