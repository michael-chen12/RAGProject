import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Tables, TablesInsert } from '@/types/database.types'

type Invitation = Tables<'invitations'>

/**
 * Lists pending (non-expired) invitations for a workspace.
 * Cached per-request.
 */
export const getInvitations = cache(
  async (supabase: SupabaseClient, workspaceId: string): Promise<Invitation[]> => {
    const { data } = await supabase
      .from('invitations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    return data ?? []
  }
)

/**
 * Creates a new invitation.
 */
export async function createInvitation(
  supabase: SupabaseClient,
  invitation: TablesInsert<'invitations'>
): Promise<Invitation | null> {
  const { data } = await supabase
    .from('invitations')
    .insert(invitation)
    .select()
    .single()

  return data ?? null
}

/**
 * Deletes an invitation by ID.
 */
export async function deleteInvitation(
  supabase: SupabaseClient,
  invitationId: string
): Promise<void> {
  await supabase
    .from('invitations')
    .delete()
    .eq('id', invitationId)
}

/**
 * Updates invitation resend metadata (increments count, updates last_sent_at).
 */
export async function updateInvitationResend(
  supabase: SupabaseClient,
  invitationId: string,
  currentCount: number
): Promise<Invitation | null> {
  const { data } = await supabase
    .from('invitations')
    .update({
      invite_count: currentCount + 1,
      last_sent_at: new Date().toISOString(),
    })
    .eq('id', invitationId)
    .select()
    .single()

  return data ?? null
}

/**
 * Gets count of invitations sent in the last hour for rate limiting.
 */
export async function getRecentInviteCount(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<number> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const { count } = await supabase
    .from('invitations')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .gte('created_at', oneHourAgo)

  return count ?? 0
}
