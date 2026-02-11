import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Tables } from '@/types/database.types'

type Workspace = Tables<'workspaces'>
type Membership = Tables<'memberships'>

export type WorkspaceWithMembership = Workspace & {
  membership: Membership
}

/**
 * Returns all workspaces the current user belongs to.
 * RLS on memberships ensures only the current user's rows are returned.
 * Wrapped in cache() to deduplicate calls within a single request.
 */
export const getWorkspacesForUser = cache(
  async (supabase: SupabaseClient): Promise<WorkspaceWithMembership[]> => {
    const { data } = await supabase
      .from('memberships')
      .select('*, workspaces(*)')
      .order('created_at', { ascending: false })

    if (!data) return []

    return data
      .filter((row) => row.workspaces !== null)
      .map((row) => ({
        ...(row.workspaces as Workspace),
        membership: {
          id: row.id,
          user_id: row.user_id,
          workspace_id: row.workspace_id,
          role: row.role,
          created_at: row.created_at,
        },
      }))
  }
)

/**
 * Returns a single workspace with the current user's membership.
 * Returns null if the user is not a member of the workspace.
 */
export const getWorkspace = cache(
  async (
    supabase: SupabaseClient,
    id: string
  ): Promise<WorkspaceWithMembership | null> => {
    const { data } = await supabase
      .from('memberships')
      .select('*, workspaces(*)')
      .eq('workspace_id', id)
      .single()

    if (!data || !data.workspaces) return null

    return {
      ...(data.workspaces as Workspace),
      membership: {
        id: data.id,
        user_id: data.user_id,
        workspace_id: data.workspace_id,
        role: data.role,
        created_at: data.created_at,
      },
    }
  }
)

/**
 * Returns the membership row for a specific user + workspace combination.
 * Returns null if not found.
 */
export const getMembership = cache(
  async (
    supabase: SupabaseClient,
    workspaceId: string,
    userId: string
  ): Promise<Membership | null> => {
    const { data } = await supabase
      .from('memberships')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .single()

    return data ?? null
  }
)
