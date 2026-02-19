import { NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { Constants } from '@/types/database.types'
import { getTicket } from '@/lib/queries/tickets'
import type { Enums } from '@/types/database.types'
import { withErrorHandler } from '@/lib/api/with-error-handler'
import { Errors } from '@/lib/api/errors'
import { setLogContext } from '@/lib/api/logger'

const VALID_STATUSES = Constants.public.Enums.ticket_status

type RouteContext = { params?: Promise<Record<string, string>> }

// ── Shared auth + membership helper ──────────────────────────────────────────
async function resolveContext(req: NextRequest, ticketId: string, requestId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw Errors.unauthorized()
  setLogContext(requestId, { userId: user.id })

  let workspaceId: string | null = null
  let body: Record<string, unknown> = {}

  if (req.method === 'GET') {
    workspaceId = new URL(req.url).searchParams.get('workspaceId')
  } else {
    try {
      body = await req.json()
      workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : null
    } catch {
      throw Errors.invalidJson()
    }
  }

  if (!workspaceId) throw Errors.validation('workspaceId is required')

  const { data: membership } = await supabase
    .from('memberships')
    .select('workspace_id, role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()

  if (!membership) throw Errors.forbidden()
  if (membership.role === 'viewer') throw Errors.forbidden()

  setLogContext(requestId, { workspaceId: membership.workspace_id })

  const ticket = await getTicket(supabase, ticketId, membership.workspace_id)
  if (!ticket) throw Errors.notFound()

  return { user, membership, ticket, body, supabase }
}

// GET /api/tickets/[id]?workspaceId=<id>
async function handleGet(req: NextRequest, { params }: RouteContext) {
  const { id: ticketId } = ((await params) ?? {}) as Record<string, string>
  const requestId = req.headers.get('x-internal-request-id') ?? ''
  const ctx = await resolveContext(req, ticketId, requestId)
  return Response.json(ctx.ticket)
}

// PATCH /api/tickets/[id] — update ticket status
async function handlePatch(req: NextRequest, { params }: RouteContext) {
  const { id: ticketId } = ((await params) ?? {}) as Record<string, string>
  const requestId = req.headers.get('x-internal-request-id') ?? ''
  const ctx = await resolveContext(req, ticketId, requestId)

  const { body } = ctx
  const newStatus = body.status

  if (!newStatus || !(VALID_STATUSES as readonly unknown[]).includes(newStatus)) {
    throw Errors.validation('Invalid or missing status')
  }

  const serviceClient = createServiceClient()
  const { data: updated, error } = await serviceClient
    .from('tickets')
    .update({ status: newStatus as Enums<'ticket_status'> })
    .eq('id', ctx.ticket.id)
    .select()
    .single()

  if (error || !updated) throw Errors.internal('Failed to update ticket')

  return Response.json(updated)
}

// POST /api/tickets/[id] — mark as missing info
async function handlePost(req: NextRequest, { params }: RouteContext) {
  const { id: ticketId } = ((await params) ?? {}) as Record<string, string>
  const requestId = req.headers.get('x-internal-request-id') ?? ''
  const ctx = await resolveContext(req, ticketId, requestId)

  const { body, membership, ticket } = ctx

  if (body.action !== 'mark_missing') throw Errors.validation('Unknown action')

  const serviceClient = createServiceClient()
  const { error } = await serviceClient.from('missing_kb_entries').insert({
    workspace_id: membership.workspace_id, // validated from DB, never from body
    question: ticket.title,
    context: 'Flagged by agent as missing info',
  })

  if (error) throw Errors.internal('Failed to log missing info')

  return Response.json({ success: true })
}

export const GET = withErrorHandler(handleGet)
export const PATCH = withErrorHandler(handlePatch)
export const POST = withErrorHandler(handlePost)
