import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { withErrorHandler } from '@/lib/api/with-error-handler'
import { Errors } from '@/lib/api/errors'
import { setLogContext } from '@/lib/api/logger'

type RouteContext = { params?: Promise<Record<string, string>> }

const MAX_RESENDS = 3

async function handlePost(req: NextRequest, { params }: RouteContext) {
  const { id: workspaceId, inviteId } = ((await params) ?? {}) as Record<string, string>
  const requestId = req.headers.get('x-internal-request-id') ?? ''

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw Errors.unauthorized()
  setLogContext(requestId, { userId: user.id, workspaceId })

  const { data: membership } = await supabase
    .from('memberships')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()

  if (!membership || membership.role !== 'admin') throw Errors.forbidden()

  const serviceClient = createServiceClient()

  const { data: invitation } = await serviceClient
    .from('invitations')
    .select('*')
    .eq('id', inviteId)
    .eq('workspace_id', workspaceId)
    .single()

  if (!invitation) throw Errors.notFound('Invitation not found')

  if ((invitation.invite_count ?? 1) >= MAX_RESENDS) {
    throw Errors.rateLimited()
  }

  await serviceClient
    .from('invitations')
    .update({
      invite_count: (invitation.invite_count ?? 1) + 1,
      last_sent_at: new Date().toISOString(),
    })
    .eq('id', inviteId)

  const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL
  await serviceClient.auth.admin.inviteUserByEmail(invitation.email, {
    redirectTo: `${origin}/auth/callback`,
  })

  return NextResponse.json({ success: true })
}

export const POST = withErrorHandler(handlePost)
