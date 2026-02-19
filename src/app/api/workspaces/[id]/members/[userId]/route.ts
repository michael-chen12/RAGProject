import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { withErrorHandler } from '@/lib/api/with-error-handler'
import { Errors } from '@/lib/api/errors'
import { setLogContext } from '@/lib/api/logger'

type RouteContext = { params?: Promise<Record<string, string>> }

const VALID_ROLES = ['admin', 'agent', 'viewer'] as const

async function handlePatch(req: NextRequest, { params }: RouteContext) {
  const { id: workspaceId, userId: targetUserId } = ((await params) ?? {}) as Record<string, string>
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

  if (targetUserId === user.id) {
    throw Errors.validation('Cannot modify your own role')
  }

  let newRole: string
  try {
    const body = await req.json()
    newRole = body.role
  } catch {
    throw Errors.invalidJson()
  }

  if (!VALID_ROLES.includes(newRole as typeof VALID_ROLES[number])) {
    throw Errors.validation('Invalid role')
  }

  const serviceClient = createServiceClient()
  const { data: updated, error } = await serviceClient
    .from('memberships')
    .update({ role: newRole as 'admin' | 'agent' | 'viewer' })
    .eq('workspace_id', workspaceId)
    .eq('user_id', targetUserId)
    .select()
    .single()

  if (error || !updated) throw Errors.internal('Failed to update role')

  return NextResponse.json(updated)
}

async function handleDelete(req: NextRequest, { params }: RouteContext) {
  const { id: workspaceId, userId: targetUserId } = ((await params) ?? {}) as Record<string, string>
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

  if (targetUserId === user.id) {
    throw Errors.validation('Cannot remove yourself')
  }

  const serviceClient = createServiceClient()

  // Guard: cannot remove the last admin
  const { count: adminCount } = await serviceClient
    .from('memberships')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('role', 'admin')

  const { data: targetMember } = await serviceClient
    .from('memberships')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', targetUserId)
    .single()

  if (targetMember?.role === 'admin' && (adminCount ?? 0) <= 1) {
    throw Errors.validation('Cannot remove the last admin')
  }

  const { error } = await serviceClient
    .from('memberships')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', targetUserId)

  if (error) throw Errors.internal('Failed to remove member')

  return NextResponse.json({ success: true })
}

export const PATCH = withErrorHandler(handlePatch)
export const DELETE = withErrorHandler(handleDelete)
