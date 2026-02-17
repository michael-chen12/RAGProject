import { redirect } from 'next/navigation'
import { requireAuth, requireWorkspaceMember } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { getTickets } from '@/lib/queries/tickets'
import { TicketCard } from '@/components/tickets/ticket-card'
import type { Enums } from '@/types/database.types'

type PageProps = { params: Promise<{ workspaceId: string }> }
type TicketStatus = Enums<'ticket_status'>

export const metadata = { title: 'Support Tickets' }

// Group order: open (most urgent) → pending → resolved
const STATUS_ORDER: TicketStatus[] = ['open', 'pending', 'resolved']

const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  pending: 'Pending',
  resolved: 'Resolved',
}

export default async function TicketsPage({ params }: PageProps) {
  const { workspaceId } = await params

  // ── Auth + RBAC ────────────────────────────────────────────────────────────
  const user = await requireAuth()
  const supabase = await createClient()
  const membership = await requireWorkspaceMember(supabase, workspaceId, user.id)

  // Viewers are redirected to workspace home (not shown a 403 error page)
  if (membership.role === 'viewer') {
    redirect(`/${workspaceId}`)
  }

  const tickets = await getTickets(supabase, workspaceId)

  // Group tickets by status
  const grouped = Object.fromEntries(
    STATUS_ORDER.map((s) => [s, tickets.filter((t) => t.status === s)])
  ) as Record<TicketStatus, typeof tickets>

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-gray-900">Support Tickets</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {tickets.length === 1 ? '1 ticket' : `${tickets.length} tickets`}
        </p>
      </div>

      {tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 border border-dashed border-gray-200 rounded-lg">
          <p className="text-sm text-gray-400">No tickets yet.</p>
          <p className="text-xs text-gray-400">Tickets will appear here when submitted from external sources.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {STATUS_ORDER.map((status) => {
            const group = grouped[status]
            if (group.length === 0) return null
            return (
              <section key={status}>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-medium text-gray-700">{STATUS_LABELS[status]}</h2>
                  <span className="text-xs text-gray-400">({group.length})</span>
                </div>
                <div className="space-y-2">
                  {group.map((ticket) => (
                    <TicketCard key={ticket.id} ticket={ticket} workspaceId={workspaceId} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
