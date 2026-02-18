import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ id: string; inviteId: string }> }

const MAX_RESENDS = 3

// POST /api/workspaces/[id]/invitations/[inviteId]/resend — resend invitation email
export async function POST(req: NextRequest, { params }: RouteContext) {
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

  const serviceClient = createServiceClient()

  // Fetch invitation and check resend limit
  const { data: invitation } = await serviceClient
    .from('invitations')
    .select('*')
    .eq('id', inviteId)
    .eq('workspace_id', workspaceId)
    .single()

  if (!invitation) {
    return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
  }

  if ((invitation.invite_count ?? 1) >= MAX_RESENDS) {
    return NextResponse.json({ error: 'Maximum resend limit reached' }, { status: 429 })
  }

  // Increment count and update last_sent_at
  await serviceClient
    .from('invitations')
    .update({
      invite_count: (invitation.invite_count ?? 1) + 1,
      last_sent_at: new Date().toISOString(),
    })
    .eq('id', inviteId)

  // Resend the invite email
  const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL
  await serviceClient.auth.admin.inviteUserByEmail(invitation.email, {
    redirectTo: `${origin}/auth/callback`,
  })

  return NextResponse.json({ success: true })
}
