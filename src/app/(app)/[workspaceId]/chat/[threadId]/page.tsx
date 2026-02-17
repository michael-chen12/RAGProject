import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/guards'
import { requireWorkspaceMember } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { getThread, getChatMessages } from '@/lib/queries/chat'
import { ChatInterface } from '@/components/chat/chat-interface'
import type { ChatMessage } from '@/hooks/use-chat-stream'

interface Props {
  params: Promise<{ workspaceId: string; threadId: string }>
}

/**
 * Chat page for a specific thread.
 * Loads existing messages server-side to avoid a loading flash on navigation.
 * If the thread doesn't exist or doesn't belong to this user, renders 404.
 */
export default async function ChatThreadPage({ params }: Props) {
  const { workspaceId, threadId } = await params

  const user = await requireAuth()
  const supabase = await createClient()
  await requireWorkspaceMember(supabase, workspaceId, user.id)

  // Strict ownership check — null if thread belongs to someone else
  const thread = await getThread(supabase, threadId, user.id, workspaceId)
  if (!thread) notFound()

  const dbMessages = await getChatMessages(supabase, threadId, user.id, workspaceId)

  // Map DB rows to the ChatMessage shape the hook expects
  const initialMessages: ChatMessage[] = dbMessages.map((msg) => ({
    id: msg.id,
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
    citations: msg.citations ?? [],
  }))

  return (
    <div className="h-full">
      <ChatInterface
        workspaceId={workspaceId}
        initialThreadId={threadId}
        initialMessages={initialMessages}
      />
    </div>
  )
}
