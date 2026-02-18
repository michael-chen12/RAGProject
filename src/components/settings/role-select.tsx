'use client'

import type { Enums } from '@/types/database.types'

type MemberRole = Enums<'member_role'>

const ROLE_OPTIONS: { value: MemberRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'agent', label: 'Agent' },
  { value: 'viewer', label: 'Viewer' },
]

interface RoleSelectProps {
  value: MemberRole
  onChange: (role: MemberRole) => void
  disabled?: boolean
}

export function RoleSelect({ value, onChange, disabled }: RoleSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as MemberRole)}
      disabled={disabled}
      className="text-sm border border-gray-200 rounded-md px-2 py-1 bg-white disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brand"
      aria-label="Select role"
    >
      {ROLE_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}
