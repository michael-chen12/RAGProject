import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/workspaces/[id]/invitations — list pending invitations (admin only)
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id: workspaceId } = await params

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

  const { data, error } = await supabase
    .from('invitations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 })
  }

  return NextResponse.json(data)
}
