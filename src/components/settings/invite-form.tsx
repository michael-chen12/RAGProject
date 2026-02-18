'use client'

import { useState } from 'react'
import { RoleSelect } from './role-select'
import type { Enums } from '@/types/database.types'

type MemberRole = Enums<'member_role'>

interface InviteFormProps {
  workspaceId: string
}

export function InviteForm({ workspaceId }: InviteFormProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<MemberRole>('viewer')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), role }),
    })

    setLoading(false)

    if (res.ok) {
      setMessage({ type: 'success', text: 'Invitation sent!' })
      setEmail('')
      setRole('viewer')
    } else {
      const data = await res.json()
      setMessage({ type: 'error', text: data.error || 'Failed to send invitation' })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-gray-200 rounded-lg p-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label htmlFor="invite-email" className="sr-only">
            Email address
          </label>
          <input
            id="invite-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>

        <RoleSelect value={role} onChange={setRole} />

        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-white bg-brand hover:bg-brand-hover rounded-md disabled:opacity-50 transition-colors"
        >
          {loading ? 'Sending...' : 'Send Invitation'}
        </button>
      </div>

      {message && (
        <p
          role={message.type === 'error' ? 'alert' : 'status'}
          className={`mt-3 text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}
        >
          {message.text}
        </p>
      )}
    </form>
  )
}
