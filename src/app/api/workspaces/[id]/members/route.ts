import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireWorkspaceMember } from '@/lib/auth/guards'

type RouteContext = { params: Promise<{ id: string }> }

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

  const { data, error } = await userSupabase
    .from('memberships')
    .select('id, role, user_id, created_at')
    .eq('workspace_id', id)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 })
  }

  return NextResponse.json(data)
}

// POST /api/workspaces/[id]/members — member invite (implemented in TASK-010)
export async function POST() {
  return NextResponse.json({ error: 'Not implemented' }, { status: 501 })
}
