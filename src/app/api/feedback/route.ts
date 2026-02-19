import { NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { withErrorHandler } from '@/lib/api/with-error-handler'
import { Errors } from '@/lib/api/errors'
import { setLogContext } from '@/lib/api/logger'

async function handlePost(req: NextRequest) {
  const requestId = req.headers.get('x-internal-request-id') ?? ''
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw Errors.unauthorized()
  setLogContext(requestId, { userId: user.id })

  let body: { messageId: string; rating: 'up' | 'down' }
  try {
    body = await req.json()
  } catch {
    throw Errors.invalidJson()
  }

  const { messageId, rating } = body
  if (!messageId || !['up', 'down'].includes(rating)) {
    throw Errors.validation('messageId and rating (up|down) are required')
  }

  // Verify the message is accessible to this user:
  // chat_messages → chat_threads → user_id must match
  const { data: message } = await supabase
    .from('chat_messages')
    .select('id, thread_id, chat_threads!inner(user_id)')
    .eq('id', messageId)
    .eq('chat_threads.user_id', user.id)
    .single()

  if (!message) throw Errors.forbidden('Message not found or access denied')

  // Upsert feedback — UNIQUE(message_id, user_id) handles re-votes
  const serviceClient = createServiceClient()
  const { error } = await serviceClient
    .from('chat_feedback')
    .upsert(
      { message_id: messageId, user_id: user.id, rating },
      { onConflict: 'message_id,user_id' }
    )

  if (error) throw Errors.internal('Failed to save feedback')

  return Response.json({ ok: true })
}

export const POST = withErrorHandler(handlePost)
