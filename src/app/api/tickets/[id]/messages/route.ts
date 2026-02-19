import { NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getTicket, getTicketMessages } from '@/lib/queries/tickets'
import { withErrorHandler } from '@/lib/api/with-error-handler'
import { Errors } from '@/lib/api/errors'
import { setLogContext } from '@/lib/api/logger'

type RouteContext = { params?: Promise<Record<string, string>> }

async function handleGet(req: NextRequest, { params }: RouteContext) {
  const { id: ticketId } = ((await params) ?? {}) as Record<string, string>
  const requestId = req.headers.get('x-internal-request-id') ?? ''

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw Errors.unauthorized()
  setLogContext(requestId, { userId: user.id })

  const workspaceId = new URL(req.url).searchParams.get('workspaceId')
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

  const messages = await getTicketMessages(supabase, ticketId)
  return Response.json(messages)
}

async function handlePost(req: NextRequest, { params }: RouteContext) {
  const { id: ticketId } = ((await params) ?? {}) as Record<string, string>
  const requestId = req.headers.get('x-internal-request-id') ?? ''

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw Errors.unauthorized()
  setLogContext(requestId, { userId: user.id })

  let body: { workspaceId?: string; content?: string }
  try {
    body = await req.json()
  } catch {
    throw Errors.invalidJson()
  }

  const { workspaceId, content } = body
  if (!workspaceId || typeof workspaceId !== 'string') {
    throw Errors.validation('workspaceId is required')
  }
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    throw Errors.validation('content is required')
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

  const ticket = await getTicket(supabase, ticketId, membership.workspace_id)
  if (!ticket) throw Errors.notFound()

  // Insert with author_id from verified auth — NEVER from request body
  const serviceClient = createServiceClient()
  const { data: message, error } = await serviceClient
    .from('ticket_messages')
    .insert({
      ticket_id: ticketId,
      content: content.trim(),
      author_id: user.id, // Always from auth session
    })
    .select()
    .single()

  if (error || !message) throw Errors.internal('Failed to add message')

  return Response.json(message, { status: 201 })
}

export const GET = withErrorHandler(handleGet)
export const POST = withErrorHandler(handlePost)
