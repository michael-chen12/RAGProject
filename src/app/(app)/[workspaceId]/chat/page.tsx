import { requireAuth } from '@/lib/auth/guards'
import { requireWorkspaceMember } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { ChatInterface } from '@/components/chat/chat-interface'

interface Props {
  params: Promise<{ workspaceId: string }>
}

/**
 * New chat page — no thread selected yet.
 * The first message sent will create a thread and redirect the URL via
 * the X-Thread-Id header (managed by the useChatStream hook).
 */
export default async function ChatPage({ params }: Props) {
  const { workspaceId } = await params

  const user = await requireAuth()
  const supabase = await createClient()
  await requireWorkspaceMember(supabase, workspaceId, user.id)

  return (
    <div className="h-full">
      <ChatInterface
        workspaceId={workspaceId}
        initialThreadId={null}
        initialMessages={[]}
      />
    </div>
  )
}
