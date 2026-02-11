import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Tables, Enums } from '@/types/database.types'

type Membership = Tables<'memberships'>
type MemberRole = Enums<'member_role'>

// Role hierarchy: viewer < agent < admin
const ROLE_RANK: Record<MemberRole, number> = {
  viewer: 0,
  agent: 1,
  admin: 2,
}

/**
 * Verifies the current session is authenticated.
 * Redirects to /login if not. Returns the authenticated User.
 */
export async function requireAuth(): Promise<User> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return user
}

/**
 * Verifies the user is a member of the given workspace.
 * Redirects to /workspaces if not. Returns the Membership row.
 */
export async function requireWorkspaceMember(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string
): Promise<Membership> {
  const { data } = await supabase
    .from('memberships')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single()

  if (!data) {
    redirect('/workspaces')
  }

  return data
}

/**
 * Verifies the membership role meets the required minimum.
 * Throws a 403 Response if insufficient — Next.js App Router serves it directly.
 */
export function requireRole(
  membershipRole: MemberRole,
  required: MemberRole
): void {
  if (ROLE_RANK[membershipRole] < ROLE_RANK[required]) {
    throw new Response('Forbidden', { status: 403 })
  }
}
