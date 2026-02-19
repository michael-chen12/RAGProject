import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requireWorkspaceMember } from '@/lib/auth/guards'
import { getProfilesByIds } from '@/lib/queries/profiles'
import { withErrorHandler } from '@/lib/api/with-error-handler'
import { Errors } from '@/lib/api/errors'
import { setLogContext } from '@/lib/api/logger'
import logger from '@/lib/api/logger'

type RouteContext = { params?: Promise<Record<string, string>> }

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const VALID_ROLES = ['admin', 'agent', 'viewer'] as const
const MAX_INVITES_PER_HOUR = 5

async function handleGet(req: NextRequest, { params }: RouteContext) {
  const { id } = ((await params) ?? {}) as Record<string, string>
  const requestId = req.headers.get('x-internal-request-id') ?? ''

  const userSupabase = await createClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) throw Errors.unauthorized()
  setLogContext(requestId, { userId: user.id, workspaceId: id })

  await requireWorkspaceMember(userSupabase, id, user.id)

  const { data: memberships, error } = await userSupabase
    .from('memberships')
    .select('id, role, user_id, created_at')
    .eq('workspace_id', id)
    .order('created_at', { ascending: true })

  if (error) throw Errors.internal('Failed to fetch members')

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

async function handlePost(req: NextRequest, { params }: RouteContext) {
  const { id: workspaceId } = ((await params) ?? {}) as Record<string, string>
  const requestId = req.headers.get('x-internal-request-id') ?? ''

  const userSupabase = await createClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) throw Errors.unauthorized()
  setLogContext(requestId, { userId: user.id, workspaceId })

  const { data: membership } = await userSupabase
    .from('memberships')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()

  if (!membership || membership.role !== 'admin') throw Errors.forbidden()

  let email: string, role: string
  try {
    const body = await req.json()
    email = (body.email ?? '').trim().toLowerCase()
    role = body.role ?? 'viewer'
  } catch {
    throw Errors.invalidJson()
  }

  if (!EMAIL_REGEX.test(email)) throw Errors.validation('Invalid email format')
  if (!VALID_ROLES.includes(role as typeof VALID_ROLES[number])) {
    throw Errors.validation('Invalid role')
  }

  const serviceClient = createServiceClient()

  // Rate limiting — max 5 invites per hour per workspace
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count } = await serviceClient
    .from('invitations')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .gte('created_at', oneHourAgo)

  if ((count ?? 0) >= MAX_INVITES_PER_HOUR) {
    throw Errors.rateLimited(3600)
  }

  // Check if already a member (return success silently to prevent email enumeration)
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

  // Check if invitation already pending (return success silently)
  const { data: existingInvite } = await serviceClient
    .from('invitations')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('email', email)
    .single()

  if (existingInvite) {
    return NextResponse.json({ success: true, message: 'Invitation sent' })
  }

  // Create invitation record
  const { error: insertError } = await serviceClient
    .from('invitations')
    .insert({
      workspace_id: workspaceId,
      email,
      role: role as 'admin' | 'agent' | 'viewer',
      invited_by: user.id,
    })

  if (insertError) {
    logger.error({ err: insertError, workspaceId, email }, 'Failed to create invitation')
    throw Errors.internal('Failed to send invitation')
  }

  // Send invite email via Supabase Auth admin API
  const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL
  await serviceClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/callback`,
  })

  return NextResponse.json({ success: true, message: 'Invitation sent' })
}

export const GET = withErrorHandler(handleGet)
export const POST = withErrorHandler(handlePost)
