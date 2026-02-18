import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ id: string; inviteId: string }> }

// DELETE /api/workspaces/[id]/invitations/[inviteId] — revoke an invitation
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { id: workspaceId, inviteId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify admin
  const { data: membership } = await supabase
    .from('memberships')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()

  if (!membership || membership.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Use service client to bypass RLS for deletion
  const serviceClient = createServiceClient()
  const { error } = await serviceClient
    .from('invitations')
    .delete()
    .eq('id', inviteId)
    .eq('workspace_id', workspaceId)

  if (error) {
    return NextResponse.json({ error: 'Failed to revoke invitation' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
