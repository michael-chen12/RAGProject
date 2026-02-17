import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getTicket, getTicketMessages } from '@/lib/queries/tickets'

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/tickets/[id]/messages?workspaceId=<id>
export async function GET(request: Request, { params }: RouteContext) {
  const { id: ticketId } = await params

  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = new URL(request.url).searchParams.get('workspaceId')
  if (!workspaceId) return Response.json({ error: 'workspaceId is required' }, { status: 400 })

  // ── Membership check ──────────────────────────────────────────────────────
  const { data: membership } = await supabase
    .from('memberships')
    .select('workspace_id, role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()

  if (!membership) return Response.json({ error: 'Forbidden' }, { status: 403 })
  if (membership.role === 'viewer') return Response.json({ error: 'Forbidden' }, { status: 403 })

  // ── Verify ticket ownership before fetching messages ──────────────────────
  const ticket = await getTicket(supabase, ticketId, membership.workspace_id)
  if (!ticket) return Response.json({ error: 'Not found' }, { status: 404 })

  const messages = await getTicketMessages(supabase, ticketId)
  return Response.json(messages)
}

// POST /api/tickets/[id]/messages — add a reply
// Body: { workspaceId, content }
export async function POST(request: Request, { params }: RouteContext) {
  const { id: ticketId } = await params

  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { workspaceId?: string; content?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { workspaceId, content } = body
  if (!workspaceId || typeof workspaceId !== 'string') {
    return Response.json({ error: 'workspaceId is required' }, { status: 400 })
  }
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return Response.json({ error: 'content is required' }, { status: 400 })
  }

  // ── Membership + role check ───────────────────────────────────────────────
  const { data: membership } = await supabase
    .from('memberships')
    .select('workspace_id, role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()

  if (!membership) return Response.json({ error: 'Forbidden' }, { status: 403 })
  if (membership.role === 'viewer') return Response.json({ error: 'Forbidden' }, { status: 403 })

  // ── Verify ticket ownership ───────────────────────────────────────────────
  const ticket = await getTicket(supabase, ticketId, membership.workspace_id)
  if (!ticket) return Response.json({ error: 'Not found' }, { status: 404 })

  // ── Insert with author_id from verified auth — NEVER from request body ─────
  const serviceClient = createServiceClient()
  const { data: message, error } = await serviceClient
    .from('ticket_messages')
    .insert({
      ticket_id: ticketId,
      content: content.trim(),
      author_id: user.id,  // Always from auth session
    })
    .select()
    .single()

  if (error || !message) {
    return Response.json({ error: 'Failed to add message' }, { status: 500 })
  }

  return Response.json(message, { status: 201 })
}
