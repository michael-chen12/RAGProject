import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Constants } from '@/types/database.types'
import { getTickets } from '@/lib/queries/tickets'
import type { Enums } from '@/types/database.types'
import { withErrorHandler } from '@/lib/api/with-error-handler'
import { Errors } from '@/lib/api/errors'
import { setLogContext } from '@/lib/api/logger'

const VALID_STATUSES = Constants.public.Enums.ticket_status

async function handleGet(req: NextRequest) {
  const requestId = req.headers.get('x-internal-request-id') ?? ''

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw Errors.unauthorized()
  setLogContext(requestId, { userId: user.id })

  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspaceId')
  const statusParam = searchParams.get('status')

  if (!workspaceId) throw Errors.validation('workspaceId is required')

  let status: Enums<'ticket_status'> | undefined
  if (statusParam) {
    if (!(VALID_STATUSES as readonly string[]).includes(statusParam)) {
      throw Errors.validation('Invalid status value')
    }
    status = statusParam as Enums<'ticket_status'>
  }

  const { data: membership } = await supabase
    .from('memberships')
    .select('workspace_id, role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()

  if (!membership) throw Errors.forbidden()
  if (membership.role === 'viewer') throw Errors.forbidden()

  setLogContext(requestId, { workspaceId: membership.workspace_id })

  const tickets = await getTickets(supabase, membership.workspace_id, status)
  return Response.json(tickets)
}

export const GET = withErrorHandler(handleGet)
