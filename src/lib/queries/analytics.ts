import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Tables } from '@/types/database.types'

type MissingKbEntry = Tables<'missing_kb_entries'>

/**
 * Returns daily chat message counts for the past N days.
 * Two-step: fetch workspace thread IDs, then aggregate user messages by date.
 */
export const getChatVolumeByDay = cache(
  async (
    supabase: SupabaseClient,
    workspaceId: string,
    days: number
  ): Promise<{ date: string; count: number }[]> => {
    // Build the N-day range to return (zero-filled by default)
    const result: { date: string; count: number }[] = []
    for (let i = 0; i < days; i++) {
      const d = new Date()
      d.setDate(d.getDate() - (days - 1 - i))
      result.push({ date: d.toISOString().slice(0, 10), count: 0 })
    }

    const { data: threads } = await supabase
      .from('chat_threads')
      .select('id')
      .eq('workspace_id', workspaceId)

    if (!threads || threads.length === 0) return result

    const since = new Date()
    since.setDate(since.getDate() - days)

    const { data: messages } = await supabase
      .from('chat_messages')
      .select('created_at')
      .in('thread_id', threads.map((t) => t.id))
      .eq('role', 'user')
      .gte('created_at', since.toISOString())

    if (!messages) return result

    for (const msg of messages) {
      const date = msg.created_at.slice(0, 10)
      const entry = result.find((r) => r.date === date)
      if (entry) entry.count++
    }

    return result
  }
)

/**
 * Aggregates thumbs-up / thumbs-down feedback for workspace chat messages.
 * Three-step: thread IDs → message IDs → feedback rows.
 */
export const getFeedbackSummary = cache(
  async (
    supabase: SupabaseClient,
    workspaceId: string
  ): Promise<{ up: number; down: number; total: number }> => {
    const { data: threads } = await supabase
      .from('chat_threads')
      .select('id')
      .eq('workspace_id', workspaceId)

    if (!threads || threads.length === 0) return { up: 0, down: 0, total: 0 }

    const { data: messages } = await supabase
      .from('chat_messages')
      .select('id')
      .in('thread_id', threads.map((t) => t.id))

    if (!messages || messages.length === 0) return { up: 0, down: 0, total: 0 }

    const { data: feedback } = await supabase
      .from('chat_feedback')
      .select('rating')
      .in('message_id', messages.map((m) => m.id))

    if (!feedback) return { up: 0, down: 0, total: 0 }

    const up = feedback.filter((f) => f.rating === 'up').length
    const down = feedback.filter((f) => f.rating === 'down').length
    return { up, down, total: up + down }
  }
)

/**
 * Lists recent missing KB entries (low-confidence queries) for the workspace.
 * These are inserted automatically by the chat route when max similarity < 0.6.
 */
export const getMissingKbEntries = cache(
  async (
    supabase: SupabaseClient,
    workspaceId: string,
    limit = 20
  ): Promise<MissingKbEntry[]> => {
    const { data } = await supabase
      .from('missing_kb_entries')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(limit)

    return data ?? []
  }
)

/**
 * Returns the most frequently asked questions in this workspace.
 * Two-step: thread IDs → user messages; aggregates by content client-side.
 */
export const getTopQueries = cache(
  async (
    supabase: SupabaseClient,
    workspaceId: string,
    limit = 10
  ): Promise<{ content: string; count: number }[]> => {
    const { data: threads } = await supabase
      .from('chat_threads')
      .select('id')
      .eq('workspace_id', workspaceId)

    if (!threads || threads.length === 0) return []

    const { data: messages } = await supabase
      .from('chat_messages')
      .select('content')
      .in('thread_id', threads.map((t) => t.id))
      .eq('role', 'user')

    if (!messages) return []

    const counts: Record<string, number> = {}
    for (const msg of messages) {
      const key = msg.content.trim().toLowerCase()
      counts[key] = (counts[key] ?? 0) + 1
    }

    return Object.entries(counts)
      .map(([content, count]) => ({ content, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
  }
)
