'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { Tables } from '@/types/database.types'

type Workspace = Tables<'workspaces'>

export function WorkspaceSwitcher({
  workspaces,
}: {
  workspaces: Workspace[]
}) {
  const params = useParams()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const currentId = params?.workspaceId as string | undefined
  const current = workspaces.find((w) => w.id === currentId)

  return (
    <div className="relative px-3 py-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-1 text-sm font-medium text-neutral-800 hover:text-neutral-900 truncate"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{current?.name ?? 'Select workspace'}</span>
        <svg
          className="w-4 h-4 shrink-0 text-neutral-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 mx-3 bg-white border border-neutral-200 rounded-md shadow-sm z-50 py-1"
        >
          {workspaces.map((ws) => (
            <li key={ws.id} role="option" aria-selected={ws.id === currentId}>
              <button
                onClick={() => {
                  setOpen(false)
                  router.push(`/${ws.id}`)
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 ${
                  ws.id === currentId ? 'font-medium text-neutral-900' : 'text-neutral-700'
                }`}
              >
                {ws.name}
              </button>
            </li>
          ))}
          <li role="separator" className="border-t border-neutral-100 my-1" />
          <li>
            <button
              onClick={() => {
                setOpen(false)
                router.push('/workspaces/new')
              }}
              className="w-full text-left px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700"
            >
              + New workspace
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}
