'use client'

import { useState } from 'react'
import { Constants } from '@/types/database.types'
import type { Enums } from '@/types/database.types'

// Source from generated constants — no hardcoding
const STATUS_OPTIONS = Constants.public.Enums.ticket_status

interface TicketStatusSelectProps {
  ticketId: string
  workspaceId: string
  initialStatus: Enums<'ticket_status'>
}

export function TicketStatusSelect({ ticketId, workspaceId, initialStatus }: TicketStatusSelectProps) {
  const [status, setStatus] = useState<Enums<'ticket_status'>>(initialStatus)
  const [saving, setSaving] = useState(false)

  async function handleChange(newStatus: Enums<'ticket_status'>) {
    if (newStatus === status || saving) return
    setSaving(true)
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, status: newStatus }),
      })
      if (res.ok) {
        setStatus(newStatus)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="ticket-status" className="text-sm font-medium text-gray-700">
        Status
      </label>
      <select
        id="ticket-status"
        value={status}
        disabled={saving}
        onChange={(e) => handleChange(e.target.value as Enums<'ticket_status'>)}
        className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </option>
        ))}
      </select>
      {saving && <span className="text-xs text-gray-400">Saving…</span>}
    </div>
  )
}
