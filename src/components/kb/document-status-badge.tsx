// Server Component — no 'use client' needed (pure CSS + SVG, no browser APIs)
import type { Enums } from '@/types/database.types'

type DocStatus = Enums<'doc_status'>

interface DocumentStatusBadgeProps {
  status: DocStatus
  errorMessage?: string | null
}

export function DocumentStatusBadge({ status, errorMessage }: DocumentStatusBadgeProps) {
  if (status === 'processing') {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5"
        role="status"
        aria-live="polite"
      >
        {/* Spinner — pure CSS animation, no JS required */}
        <svg
          className="animate-spin h-3 w-3 text-amber-500"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        Indexing…
      </span>
    )
  }

  if (status === 'indexed') {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-0.5"
        aria-label="Indexed — ready for search"
      >
        <svg
          className="h-3 w-3 text-green-500"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
        Indexed
      </span>
    )
  }

  // status === 'failed'
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-full px-2.5 py-0.5 cursor-help"
      title={errorMessage ?? 'Processing failed'}
    >
      <svg
        className="h-3 w-3 text-red-500"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
          clipRule="evenodd"
        />
      </svg>
      Failed
    </span>
  )
}
