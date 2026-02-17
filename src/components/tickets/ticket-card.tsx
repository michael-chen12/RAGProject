'use client'

import Link from 'next/link'
import type { Tables, Enums } from '@/types/database.types'

type Ticket = Tables<'tickets'>
type TicketStatus = Enums<'ticket_status'>

const STATUS_STYLES: Record<TicketStatus, string> = {
  open: 'bg-red-50 text-red-700 border border-red-200',
  pending: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  resolved: 'bg-green-50 text-green-700 border border-green-200',
}

interface TicketCardProps {
  ticket: Ticket
  workspaceId: string
}

export function TicketCard({ ticket, workspaceId }: TicketCardProps) {
  const createdAt = new Date(ticket.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <Link
      href={`/${workspaceId}/tickets/${ticket.id}`}
      className="block border border-gray-200 rounded-lg p-4 hover:bg-gray-50 hover:border-gray-300 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-gray-900 line-clamp-2 flex-1">{ticket.title}</p>
        <span
          className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[ticket.status]}`}
        >
          {ticket.status}
        </span>
      </div>
      <p className="text-xs text-gray-400 mt-2">{createdAt}</p>
    </Link>
  )
}
