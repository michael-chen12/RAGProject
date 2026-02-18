import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requireWorkspaceMember } from '@/lib/auth/guards'
import { getProfilesByIds } from '@/lib/queries/profiles'

type RouteContext = { params: Promise<{ id: string }> }

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const VALID_ROLES = ['admin', 'agent', 'viewer'] as const
const MAX_INVITES_PER_HOUR = 5

// GET /api/workspaces/[id]/members — list members with profile data
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params

  const userSupabase = await createClient()
  const {
    data: { user },
  } = await userSupabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify caller is a member of this workspace
  await requireWorkspaceMember(userSupabase, id, user.id)

  // Fetch memberships
  const { data: memberships, error } = await userSupabase
    .from('memberships')
    .select('id, role, user_id, created_at')
    .eq('workspace_id', id)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 })
  }

  // Fetch profiles for all member user IDs and merge
  const userIds = memberships?.map((m) => m.user_id) ?? []
  const profiles = await getProfilesByIds(userSupabase, userIds)
  const profileMap = new Map(profiles.map((p) => [p.id, p]))

  const members = memberships?.map((m) => {
    const profile = profileMap.get(m.user_id)
    return {
      ...m,
      email: profile?.email ?? null,
      first_name: profile?.first_name ?? null,
      last_name: profile?.last_name ?? null,
    }
  }) ?? []

  return NextResponse.json(members)
}

// POST /api/workspaces/[id]/members — invite a new member by email
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { id: workspaceId } = await params

  // 1. Auth check
  const userSupabase = await createClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Verify admin role
  const { data: membership } = await userSupabase
    .from('memberships')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()

  if (!membership || membership.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 3. Parse and validate body
  let email: string, role: string
  try {
    const body = await req.json()
    email = (body.email ?? '').trim().toLowerCase()
    role = body.role ?? 'viewer'
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
  }

  if (!VALID_ROLES.includes(role as typeof VALID_ROLES[number])) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const serviceClient = createServiceClient()

  // 4. Rate limiting — max 5 invites per hour per workspace
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count } = await serviceClient
    .from('invitations')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .gte('created_at', oneHourAgo)

  if ((count ?? 0) >= MAX_INVITES_PER_HOUR) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429 })
  }

  // 5. Check if already a member (return success silently to prevent email enumeration)
  const { data: existingProfile } = await serviceClient
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single()

  if (existingProfile) {
    const { data: existingMember } = await serviceClient
      .from('memberships')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', existingProfile.id)
      .single()

    if (existingMember) {
      return NextResponse.json({ success: true, message: 'Invitation sent' })
    }
  }

  // 6. Check if invitation already pending (return success silently)
  const { data: existingInvite } = await serviceClient
    .from('invitations')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('email', email)
    .single()

  if (existingInvite) {
    return NextResponse.json({ success: true, message: 'Invitation sent' })
  }

  // 7. Create invitation record
  const { error: insertError } = await serviceClient
    .from('invitations')
    .insert({
      workspace_id: workspaceId,
      email,
      role: role as 'admin' | 'agent' | 'viewer',
      invited_by: user.id,
    })

  if (insertError) {
    console.error('Failed to create invitation:', insertError)
    return NextResponse.json({ error: 'Failed to send invitation' }, { status: 500 })
  }

  // 8. Send invite email via Supabase Auth admin API
  const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL
  await serviceClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/callback`,
  })

  return NextResponse.json({ success: true, message: 'Invitation sent' })
}
