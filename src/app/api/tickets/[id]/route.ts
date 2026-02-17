import { createClient, createServiceClient } from '@/lib/supabase/server'
import { Constants } from '@/types/database.types'
import { getTicket } from '@/lib/queries/tickets'
import type { Enums } from '@/types/database.types'

const VALID_STATUSES = Constants.public.Enums.ticket_status

type RouteContext = { params: Promise<{ id: string }> }

// ── Shared auth + membership helper ──────────────────────────────────────────
async function resolveContext(request: Request, ticketId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) }

  // Parse workspaceId from body (POST/PATCH) or query params (GET)
  let workspaceId: string | null = null
  let body: Record<string, unknown> = {}

  if (request.method === 'GET') {
    workspaceId = new URL(request.url).searchParams.get('workspaceId')
  } else {
    try {
      body = await request.json()
      workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : null
    } catch {
      return { error: Response.json({ error: 'Invalid JSON' }, { status: 400 }) }
    }
  }

  if (!workspaceId) {
    return { error: Response.json({ error: 'workspaceId is required' }, { status: 400 }) }
  }

  const { data: membership } = await supabase
    .from('memberships')
    .select('workspace_id, role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()

  if (!membership) return { error: Response.json({ error: 'Forbidden' }, { status: 403 }) }
  if (membership.role === 'viewer') return { error: Response.json({ error: 'Forbidden' }, { status: 403 }) }

  // Verify ticket ownership using validated workspace_id from DB (never from body)
  const ticket = await getTicket(supabase, ticketId, membership.workspace_id)
  if (!ticket) return { error: Response.json({ error: 'Not found' }, { status: 404 }) }

  return { user, membership, ticket, body, supabase }
}

// GET /api/tickets/[id]?workspaceId=<id>
export async function GET(request: Request, { params }: RouteContext) {
  const { id } = await params
  const ctx = await resolveContext(request, id)
  if ('error' in ctx) return ctx.error
  return Response.json(ctx.ticket)
}

// PATCH /api/tickets/[id] — update ticket status
// Body: { workspaceId, status }
export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params
  const ctx = await resolveContext(request, id)
  if ('error' in ctx) return ctx.error

  const { body } = ctx
  const newStatus = body.status

  if (!newStatus || !(VALID_STATUSES as readonly unknown[]).includes(newStatus)) {
    return Response.json({ error: 'Invalid or missing status' }, { status: 400 })
  }

  const serviceClient = createServiceClient()
  const { data: updated, error } = await serviceClient
    .from('tickets')
    .update({ status: newStatus as Enums<'ticket_status'> })
    .eq('id', ctx.ticket.id)
    .select()
    .single()

  if (error || !updated) {
    return Response.json({ error: 'Failed to update ticket' }, { status: 500 })
  }

  return Response.json(updated)
}

// POST /api/tickets/[id] — mark as missing info
// Body: { workspaceId, action: 'mark_missing' }
export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params
  const ctx = await resolveContext(request, id)
  if ('error' in ctx) return ctx.error

  const { body, membership, ticket } = ctx

  if (body.action !== 'mark_missing') {
    return Response.json({ error: 'Unknown action' }, { status: 400 })
  }

  const serviceClient = createServiceClient()
  const { error } = await serviceClient.from('missing_kb_entries').insert({
    workspace_id: membership.workspace_id,  // validated from DB, never from body
    question: ticket.title,
    context: 'Flagged by agent as missing info',
  })

  if (error) {
    return Response.json({ error: 'Failed to log missing info' }, { status: 500 })
  }

  return Response.json({ success: true })
}
