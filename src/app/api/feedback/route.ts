import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse body
  let body: { messageId: string; rating: 'up' | 'down' }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { messageId, rating } = body
  if (!messageId || !['up', 'down'].includes(rating)) {
    return Response.json({ error: 'messageId and rating (up|down) are required' }, { status: 400 })
  }

  // Verify the message is accessible to this user:
  // chat_messages → chat_threads → user_id must match
  const { data: message } = await supabase
    .from('chat_messages')
    .select('id, thread_id, chat_threads!inner(user_id)')
    .eq('id', messageId)
    .eq('chat_threads.user_id', user.id)
    .single()

  if (!message) {
    return Response.json({ error: 'Message not found or access denied' }, { status: 403 })
  }

  // Upsert feedback — UNIQUE(message_id, user_id) handles re-votes
  const serviceClient = createServiceClient()
  const { error } = await serviceClient
    .from('chat_feedback')
    .upsert(
      { message_id: messageId, user_id: user.id, rating },
      { onConflict: 'message_id,user_id' }
    )

  if (error) {
    return Response.json({ error: 'Failed to save feedback' }, { status: 500 })
  }

  return Response.json({ ok: true })
}
