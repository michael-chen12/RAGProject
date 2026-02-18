import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ id: string; userId: string }> }

const VALID_ROLES = ['admin', 'agent', 'viewer'] as const

// PATCH /api/workspaces/[id]/members/[userId] — change a member's role
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id: workspaceId, userId: targetUserId } = await params

  const userSupabase = await createClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify caller is admin
  const { data: membership } = await userSupabase
    .from('memberships')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()

  if (!membership || membership.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Prevent self-modification
  if (targetUserId === user.id) {
    return NextResponse.json({ error: 'Cannot modify your own role' }, { status: 400 })
  }

  // Parse body
  let newRole: string
  try {
    const body = await req.json()
    newRole = body.role
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!VALID_ROLES.includes(newRole as typeof VALID_ROLES[number])) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  // Update role using service client to bypass RLS
  const serviceClient = createServiceClient()
  const { data: updated, error } = await serviceClient
    .from('memberships')
    .update({ role: newRole as 'admin' | 'agent' | 'viewer' })
    .eq('workspace_id', workspaceId)
    .eq('user_id', targetUserId)
    .select()
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 })
  }

  return NextResponse.json(updated)
}

// DELETE /api/workspaces/[id]/members/[userId] — remove a member
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { id: workspaceId, userId: targetUserId } = await params

  const userSupabase = await createClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify caller is admin
  const { data: membership } = await userSupabase
    .from('memberships')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()

  if (!membership || membership.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Prevent self-removal
  if (targetUserId === user.id) {
    return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 })
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
    return NextResponse.json({ error: 'Cannot remove the last admin' }, { status: 400 })
  }

  const { error } = await serviceClient
    .from('memberships')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', targetUserId)

  if (error) {
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
