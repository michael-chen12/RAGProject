import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withErrorHandler } from '@/lib/api/with-error-handler'
import { Errors } from '@/lib/api/errors'
import { setLogContext } from '@/lib/api/logger'

async function handleGet(req: NextRequest) {
  const requestId = req.headers.get('x-internal-request-id') ?? ''
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw Errors.unauthorized()
  setLogContext(requestId, { userId: user.id })

  // Parse workspaceId from query string
  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspaceId')
  if (!workspaceId) throw Errors.validation('workspaceId query parameter is required')

  setLogContext(requestId, { workspaceId })

  // Membership check — verifies the user belongs to this workspace
  const { data: membership } = await supabase
    .from('memberships')
    .select('workspace_id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()

  if (!membership) throw Errors.forbidden()

  // Fetch threads for this user + workspace, newest first
  const { data: threads } = await supabase
    .from('chat_threads')
    .select('id, title, created_at')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return Response.json({ threads: threads ?? [] })
}

export const GET = withErrorHandler(handleGet)
