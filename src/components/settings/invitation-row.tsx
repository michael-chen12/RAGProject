'use client'

import { useState } from 'react'
import type { Tables } from '@/types/database.types'

type Invitation = Tables<'invitations'>

interface InvitationRowProps {
  invitation: Invitation
  workspaceId: string
  onRevoke: () => void
  onResend: () => void
}

export function InvitationRow({ invitation, workspaceId, onRevoke, onResend }: InvitationRowProps) {
  const [loading, setLoading] = useState(false)

  const expiresAt = new Date(invitation.expires_at)
  const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const canResend = (invitation.invite_count ?? 1) < 3

  async function handleResend() {
    setLoading(true)
    const res = await fetch(
      `/api/workspaces/${workspaceId}/invitations/${invitation.id}/resend`,
      { method: 'POST' }
    )
    setLoading(false)

    if (res.ok) {
      onResend()
    } else {
      const data = await res.json()
      alert(data.error || 'Failed to resend invitation')
    }
  }

  async function handleRevoke() {
    if (!confirm(`Revoke invitation for ${invitation.email}?`)) return
    setLoading(true)

    const res = await fetch(
      `/api/workspaces/${workspaceId}/invitations/${invitation.id}`,
      { method: 'DELETE' }
    )
    setLoading(false)

    if (res.ok) {
      onRevoke()
    } else {
      const data = await res.json()
      alert(data.error || 'Failed to revoke invitation')
    }
  }

  return (
    <div className="flex items-center justify-between py-3 px-4 border-b border-gray-100 last:border-b-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900 truncate">{invitation.email}</p>
        <p className="text-xs text-gray-400 capitalize">
          {invitation.role} · Expires in {daysLeft}d
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleResend}
          disabled={loading || !canResend}
          className="text-xs text-brand hover:text-brand-hover disabled:opacity-50 disabled:cursor-not-allowed"
          title={!canResend ? 'Maximum resend limit reached' : 'Resend invitation'}
        >
          Resend
        </button>
        <button
          onClick={handleRevoke}
          disabled={loading}
          className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
        >
          Revoke
        </button>
      </div>
    </div>
  )
}
