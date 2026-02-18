'use client'

import { useState, useEffect, useCallback } from 'react'
import { MemberRow } from './member-row'
import type { Enums } from '@/types/database.types'

type MemberRole = Enums<'member_role'>

interface Member {
  id: string
  user_id: string
  role: MemberRole
  email: string | null
  first_name: string | null
  last_name: string | null
}

interface MembersListProps {
  workspaceId: string
  currentUserId: string
}

export function MembersList({ workspaceId, currentUserId }: MembersListProps) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)

  const fetchMembers = useCallback(async () => {
    const res = await fetch(`/api/workspaces/${workspaceId}/members`)
    if (res.ok) {
      const data = await res.json()
      setMembers(data)
    }
    setLoading(false)
  }, [workspaceId])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  const adminCount = members.filter((m) => m.role === 'admin').length

  if (loading) {
    return (
      <div className="border border-gray-200 rounded-lg p-4">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-gray-100 rounded" />
          ))}
        </div>
      </div>
    )
  }

  if (members.length === 0) {
    return (
      <div className="border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-sm text-gray-400">No members found.</p>
      </div>
    )
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {members.map((member) => (
        <MemberRow
          key={member.id}
          member={member}
          isCurrentUser={member.user_id === currentUserId}
          isLastAdmin={adminCount === 1 && member.role === 'admin'}
          workspaceId={workspaceId}
          onRoleChange={fetchMembers}
          onRemove={fetchMembers}
        />
      ))}
    </div>
  )
}
