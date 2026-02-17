import { createClient } from '@/lib/supabase/server'
import { Constants } from '@/types/database.types'
import { getTickets } from '@/lib/queries/tickets'
import type { Enums } from '@/types/database.types'

const VALID_STATUSES = Constants.public.Enums.ticket_status

// GET /api/tickets?workspaceId=<id>&status=<optional>
// Role: agent minimum (viewers → 403, unauthenticated → 401)
export async function GET(request: Request) {
  // ── Step a: Auth ──────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Step b: Parse query params ─────────────────────────────────────────────
  const { searchParams } = new URL(request.url)
  const workspaceId = searchParams.get('workspaceId')
  const statusParam = searchParams.get('status')

  if (!workspaceId || typeof workspaceId !== 'string') {
    return Response.json({ error: 'workspaceId is required' }, { status: 400 })
  }

  // Validate optional status against the enum values (no hardcoding)
  let status: Enums<'ticket_status'> | undefined
  if (statusParam) {
    if (!(VALID_STATUSES as readonly string[]).includes(statusParam)) {
      return Response.json({ error: 'Invalid status value' }, { status: 400 })
    }
    status = statusParam as Enums<'ticket_status'>
  }

  // ── Step c: Workspace membership check ────────────────────────────────────
  // workspaceId for the query comes from membership.workspace_id — not from URL param.
  const { data: membership } = await supabase
    .from('memberships')
    .select('workspace_id, role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Step d: Role check — agent minimum ────────────────────────────────────
  if (membership.role === 'viewer') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Step e: Query with validated workspace ID from DB ─────────────────────
  const tickets = await getTickets(supabase, membership.workspace_id, status)
  return Response.json(tickets)
}
