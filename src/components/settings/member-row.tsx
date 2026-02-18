'use client'

import { useState } from 'react'
import { RoleSelect } from './role-select'
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

interface MemberRowProps {
  member: Member
  isCurrentUser: boolean
  isLastAdmin: boolean
  workspaceId: string
  onRoleChange: () => void
  onRemove: () => void
}

export function MemberRow({
  member,
  isCurrentUser,
  isLastAdmin,
  workspaceId,
  onRoleChange,
  onRemove,
}: MemberRowProps) {
  const [loading, setLoading] = useState(false)
  const [role, setRole] = useState(member.role)

  const displayName =
    member.first_name && member.last_name
      ? `${member.first_name} ${member.last_name}`
      : member.email ?? 'Unknown'

  async function handleRoleChange(newRole: MemberRole) {
    if (newRole === role) return
    setLoading(true)

    const res = await fetch(`/api/workspaces/${workspaceId}/members/${member.user_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    })

    setLoading(false)

    if (res.ok) {
      setRole(newRole)
      onRoleChange()
    } else {
      const data = await res.json()
      alert(data.error || 'Failed to update role')
    }
  }

  async function handleRemove() {
    if (!confirm(`Remove ${displayName} from this workspace?`)) return
    setLoading(true)

    const res = await fetch(`/api/workspaces/${workspaceId}/members/${member.user_id}`, {
      method: 'DELETE',
    })

    setLoading(false)

    if (res.ok) {
      onRemove()
    } else {
      const data = await res.json()
      alert(data.error || 'Failed to remove member')
    }
  }

  const canModify = !isCurrentUser
  const canRemove = canModify && !(isLastAdmin && role === 'admin')

  return (
    <div className="flex items-center justify-between py-3 px-4 border-b border-gray-100 last:border-b-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 truncate">{displayName}</span>
          {isCurrentUser && (
            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">(you)</span>
          )}
        </div>
        {member.email && (
          <p className="text-xs text-gray-400 truncate">{member.email}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <RoleSelect
          value={role}
          onChange={handleRoleChange}
          disabled={!canModify || loading}
        />
        <button
          onClick={handleRemove}
          disabled={!canRemove || loading}
          className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title={
            isLastAdmin && role === 'admin'
              ? 'Cannot remove the last admin'
              : 'Remove member'
          }
        >
          Remove
        </button>
      </div>
    </div>
  )
}
