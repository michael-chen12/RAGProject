import { redirect, notFound } from 'next/navigation'
import { Suspense } from 'react'
import { requireAuth, requireWorkspaceMember } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { getTicket, getTicketMessages } from '@/lib/queries/tickets'
import { TicketStatusSelect } from '@/components/tickets/ticket-status-select'
import { DraftReplyPanel } from '@/components/tickets/draft-reply-panel'
import { AiSuggestionPanel, SuggestionSkeleton } from '@/components/tickets/ai-suggestion-panel'

type PageProps = { params: Promise<{ workspaceId: string; ticketId: string }> }

export async function generateMetadata({ params }: PageProps) {
  const { workspaceId, ticketId } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('tickets')
    .select('title')
    .eq('id', ticketId)
    .eq('workspace_id', workspaceId)
    .single()
  return { title: data?.title ?? 'Ticket' }
}

export default async function TicketDetailPage({ params }: PageProps) {
  const { workspaceId, ticketId } = await params

  // ── Auth + RBAC ────────────────────────────────────────────────────────────
  const user = await requireAuth()
  const supabase = await createClient()
  const membership = await requireWorkspaceMember(supabase, workspaceId, user.id)

  if (membership.role === 'viewer') {
    redirect(`/${workspaceId}`)
  }

  // ── Parallel data fetch ───────────────────────────────────────────────────
  // Both queries are independent — run concurrently to halve wait time.
  // getTicketMessages returns [] if ticketId is invalid, so ordering is safe.
  const [ticket, messages] = await Promise.all([
    getTicket(supabase, ticketId, workspaceId),
    getTicketMessages(supabase, ticketId),
  ])

  if (!ticket) notFound()

  const createdAt = new Date(ticket.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      {/* Back link */}
      <a
        href={`/${workspaceId}/tickets`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        ← All tickets
      </a>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── LEFT (2/3): ticket detail + messages + draft reply ─────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ticket header */}
          <div className="border border-gray-200 rounded-lg p-5">
            <div className="flex items-start justify-between gap-4 mb-3">
              <h1 className="text-lg font-semibold text-gray-900 flex-1">{ticket.title}</h1>
              <TicketStatusSelect
                ticketId={ticket.id}
                workspaceId={workspaceId}
                initialStatus={ticket.status}
              />
            </div>
            <p className="text-xs text-gray-400">Opened {createdAt}</p>
          </div>

          {/* Ticket messages */}
          {messages.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-200 px-4 py-2">
                <h2 className="text-sm font-medium text-gray-700">Messages ({messages.length})</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {messages.map((msg) => (
                  <div key={msg.id} className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-gray-400">{msg.author_id.slice(0, 8)}…</span>
                      <span className="text-xs text-gray-300">·</span>
                      <time className="text-xs text-gray-400">
                        {new Date(msg.created_at).toLocaleString()}
                      </time>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{msg.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Draft reply panel */}
          <div className="border border-gray-200 rounded-lg p-5">
            <h2 className="text-sm font-medium text-gray-700 mb-3">Reply</h2>
            <DraftReplyPanel ticket={ticket} workspaceId={workspaceId} />
          </div>
        </div>

        {/* ── RIGHT (1/3): AI-suggested KB articles ─────────────────────────── */}
        <div className="lg:col-span-1">
          <div className="border border-gray-200 rounded-lg p-4 sticky top-6">
            <h2 className="text-sm font-medium text-gray-700 mb-3">Relevant KB Articles</h2>
            <Suspense fallback={<SuggestionSkeleton />}>
              {/* AiSuggestionPanel is a Server Component that runs embedText + retrieveChunks.
                  workspaceId comes from the DB-validated membership — never from user input. */}
              <AiSuggestionPanel
                ticketTitle={ticket.title}
                workspaceId={workspaceId}
                ticketId={ticket.id}
              />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  )
}
