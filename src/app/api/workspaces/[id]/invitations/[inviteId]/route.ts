import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { withErrorHandler } from '@/lib/api/with-error-handler'
import { Errors } from '@/lib/api/errors'
import { setLogContext } from '@/lib/api/logger'

type RouteContext = { params?: Promise<Record<string, string>> }

async function handleDelete(req: NextRequest, { params }: RouteContext) {
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
  const { error } = await serviceClient
    .from('invitations')
    .delete()
    .eq('id', inviteId)
    .eq('workspace_id', workspaceId)

  if (error) throw Errors.internal('Failed to revoke invitation')

  return NextResponse.json({ success: true })
}

export const DELETE = withErrorHandler(handleDelete)
