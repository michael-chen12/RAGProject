'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface DeleteDocumentButtonProps {
  documentId: string
  workspaceId: string
  collectionId?: string | null
  /** compact=true renders an icon-only button for table rows */
  compact?: boolean
}

/**
 * Deletes a document via DELETE /api/workspaces/[id]/documents/[documentId].
 * On success, navigates back to the collection (or /kb if no collection).
 *
 * Requires admin role — the API enforces this; the button can be conditionally
 * rendered in parent components based on role.
 */
export function DeleteDocumentButton({
  documentId,
  workspaceId,
  collectionId,
  compact = false,
}: DeleteDocumentButtonProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    const confirmed = window.confirm(
      'Delete this document? All chunks will be permanently removed. This cannot be undone.'
    )
    if (!confirmed) return

    setLoading(true)
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/documents/${documentId}`,
        { method: 'DELETE' }
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        alert(body.error ?? 'Failed to delete document')
        return
      }

      // Navigate to the collection page (or /kb if uncollected), then refresh
      // router.refresh() re-fetches server components so the deleted doc disappears
      const destination = collectionId
        ? `/${workspaceId}/kb/${collectionId}`
        : `/${workspaceId}/kb`
      router.push(destination)
      router.refresh()
    } catch {
      alert('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (compact) {
    return (
      <button
        onClick={handleDelete}
        disabled={loading}
        className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
        title="Delete document"
        aria-label="Delete document"
      >
        <svg
          className="h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    )
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors disabled:opacity-50"
    >
      <svg
        className="h-4 w-4"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
      {loading ? 'Deleting…' : 'Delete Document'}
    </button>
  )
}
