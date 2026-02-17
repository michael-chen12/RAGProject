'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Thread {
  id: string
  title: string
  created_at: string
}

interface ThreadListProps {
  workspaceId: string
  currentThreadId: string | null
}

/**
 * Sidebar component that lists the user's recent chat threads.
 * Fetches threads from GET /api/chat/threads?workspaceId=...
 * Highlights the currently active thread.
 */
export function ThreadList({ workspaceId, currentThreadId }: ThreadListProps) {
  const [threads, setThreads] = useState<Thread[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchThreads() {
      try {
        const res = await fetch(`/api/chat/threads?workspaceId=${encodeURIComponent(workspaceId)}`)
        if (res.ok) {
          const data = await res.json()
          setThreads(data.threads ?? [])
        }
      } finally {
        setIsLoading(false)
      }
    }
    fetchThreads()
  }, [workspaceId])

  return (
    <nav className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-200">
        <Link
          href={`/${workspaceId}/chat`}
          className="flex items-center justify-center gap-2 w-full px-3 py-2
                     bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New chat
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {isLoading ? (
          <div className="px-3 py-2 text-xs text-gray-400">Loading threads...</div>
        ) : threads.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-gray-400">No conversations yet</div>
        ) : (
          threads.map((thread) => (
            <Link
              key={thread.id}
              href={`/${workspaceId}/chat/${thread.id}`}
              className={`flex flex-col px-3 py-2 mx-1 rounded-lg text-sm transition-colors
                          ${currentThreadId === thread.id
                            ? 'bg-blue-50 text-blue-700 font-medium'
                            : 'text-gray-700 hover:bg-gray-100'
                          }`}
            >
              <span className="truncate">{thread.title}</span>
              <span className="text-xs text-gray-400 mt-0.5">
                {new Date(thread.created_at).toLocaleDateString()}
              </span>
            </Link>
          ))
        )}
      </div>
    </nav>
  )
}
