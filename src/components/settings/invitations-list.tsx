'use client'

import { useState, useEffect, useCallback } from 'react'
import { InvitationRow } from './invitation-row'
import type { Tables } from '@/types/database.types'

type Invitation = Tables<'invitations'>

interface InvitationsListProps {
  workspaceId: string
}

export function InvitationsList({ workspaceId }: InvitationsListProps) {
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)

  const fetchInvitations = useCallback(async () => {
    const res = await fetch(`/api/workspaces/${workspaceId}/invitations`)
    if (res.ok) {
      const data = await res.json()
      setInvitations(data)
    }
    setLoading(false)
  }, [workspaceId])

  useEffect(() => {
    fetchInvitations()
  }, [fetchInvitations])

  if (loading) {
    return (
      <div className="border border-gray-200 rounded-lg p-4">
        <div className="animate-pulse h-10 bg-gray-100 rounded" />
      </div>
    )
  }

  if (invitations.length === 0) {
    return (
      <div className="border border-dashed border-gray-200 rounded-lg p-6 text-center">
        <p className="text-sm text-gray-400">No pending invitations.</p>
      </div>
    )
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {invitations.map((invitation) => (
        <InvitationRow
          key={invitation.id}
          invitation={invitation}
          workspaceId={workspaceId}
          onRevoke={fetchInvitations}
          onResend={fetchInvitations}
        />
      ))}
    </div>
  )
}
