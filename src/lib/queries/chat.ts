import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Tables } from '@/types/database.types'
import type { CitationEntry } from '@/lib/rag/prompt'

type ChatThread = Tables<'chat_threads'>
type ChatMessage = Tables<'chat_messages'>

/** A chat message with citations typed as CitationEntry[]. */
export type ChatMessageWithCitations = Omit<ChatMessage, 'citations'> & {
  citations: CitationEntry[] | null
}

/**
 * Fetches a single chat thread.
 * Filters by threadId + userId + workspaceId to ensure strict privacy:
 * users can only access their own threads in workspaces they belong to.
 */
export const getThread = cache(
  async (
    supabase: SupabaseClient,
    threadId: string,
    userId: string,
    workspaceId: string
  ): Promise<ChatThread | null> => {
    const { data } = await supabase
      .from('chat_threads')
      .select('*')
      .eq('id', threadId)
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .single()

    return data ?? null
  }
)

/**
 * Lists all threads for a user in a workspace, newest first.
 */
export const getThreads = cache(
  async (
    supabase: SupabaseClient,
    userId: string,
    workspaceId: string
  ): Promise<ChatThread[]> => {
    const { data } = await supabase
      .from('chat_threads')
      .select('*')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    return data ?? []
  }
)

/**
 * Fetches all messages for a thread, in chronological order.
 * Verifies thread ownership by joining through the thread's user_id and workspace_id.
 * The join approach prevents accessing messages from threads that belong to other users.
 */
export const getChatMessages = cache(
  async (
    supabase: SupabaseClient,
    threadId: string,
    userId: string,
    workspaceId: string
  ): Promise<ChatMessageWithCitations[]> => {
    // First verify thread ownership (re-uses the cached getThread query)
    const thread = await getThread(supabase, threadId, userId, workspaceId)
    if (!thread) return []

    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })

    return (data ?? []) as ChatMessageWithCitations[]
  }
)
