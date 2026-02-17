'use client'

import Link from 'next/link'
import type { CollectionWithCount } from '@/lib/queries/collections'

interface CollectionCardProps {
  collection: CollectionWithCount
  workspaceId: string
  /** Only admins see the delete button */
  canDelete: boolean
}

/**
 * Card linking to a collection's document list.
 * Delete button is shown on hover (admin only).
 *
 * Why window.location.reload() instead of router.refresh()?
 * The parent /kb page is a Server Component. router.refresh() works when
 * called from within the same route, but after a navigation (or when the
 * parent can't receive the refresh signal), a full reload is more reliable.
 */
export function CollectionCard({ collection, workspaceId, canDelete }: CollectionCardProps) {
  const handleDelete = async (e: React.MouseEvent) => {
    // Prevent the Link from navigating when clicking delete
    e.preventDefault()

    const confirmed = window.confirm(
      `Delete "${collection.name}"?\n\nDocuments in this collection will NOT be deleted — they will become uncollected and still appear in the knowledge base.`
    )
    if (!confirmed) return

    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/collections/${collection.id}`,
        { method: 'DELETE' }
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        alert(body.error ?? 'Failed to delete collection')
        return
      }
      window.location.reload()
    } catch {
      alert('Network error. Please try again.')
    }
  }

  return (
    <Link
      href={`/${workspaceId}/kb/${collection.id}`}
      className="group relative block bg-white border border-gray-200 rounded-lg p-5 hover:border-gray-300 hover:shadow-sm transition-all"
    >
      {/* Visibility badge */}
      <div className="flex items-center justify-between mb-3">
        <span
          className={`inline-flex items-center text-xs font-medium rounded-full px-2 py-0.5 ${
            collection.visibility === 'private'
              ? 'bg-amber-50 text-amber-700 border border-amber-200'
              : 'bg-gray-100 text-gray-500'
          }`}
        >
          {collection.visibility === 'private' ? '🔒 Private' : 'Public'}
        </span>

        {/* Delete button — only visible on hover, only for admins */}
        {canDelete && (
          <button
            onClick={handleDelete}
            className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all"
            title="Delete collection"
            aria-label={`Delete collection ${collection.name}`}
          >
            <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>

      {/* Collection name */}
      <h3 className="text-sm font-semibold text-gray-900 mb-1 truncate">
        {collection.name}
      </h3>

      {/* Document count */}
      <p className="text-xs text-gray-400">
        {collection.doc_count === 1
          ? '1 document'
          : `${collection.doc_count} documents`}
      </p>
    </Link>
  )
}
