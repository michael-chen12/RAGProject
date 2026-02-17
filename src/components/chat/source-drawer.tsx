'use client'

import { useEffect } from 'react'
import type { CitationEntry } from '@/lib/rag/prompt'

interface SourceDrawerProps {
  citation: CitationEntry | null
  onClose: () => void
}

/**
 * A right-side sliding panel that shows the full source chunk for a citation.
 * Opens when a CitationPill is clicked, closes on X button or Escape key.
 *
 * Uses CSS transform (GPU-accelerated) for smooth animation.
 */
export function SourceDrawer({ citation, onClose }: SourceDrawerProps) {
  const isOpen = citation !== null

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  return (
    <>
      {/* Overlay backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer panel */}
      <aside
        role="complementary"
        aria-label="Source details"
        aria-hidden={!isOpen}
        className={`fixed top-0 right-0 h-full w-96 max-w-full bg-white shadow-2xl z-50
                    flex flex-col transition-transform duration-300 ease-in-out
                    ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">
            Source [{citation?.index}]
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
            aria-label="Close source drawer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        {citation && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">File</p>
              <p className="text-sm text-gray-900 font-medium break-all">{citation.filename}</p>
            </div>

            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">
                Similarity
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${Math.round(citation.similarity * 100)}%` }}
                  />
                </div>
                <span className="text-sm text-gray-700 font-medium tabular-nums">
                  {Math.round(citation.similarity * 100)}%
                </span>
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2">
                Excerpt
              </p>
              <blockquote className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 border-l-4 border-blue-300 leading-relaxed whitespace-pre-wrap">
                {citation.snippet}
              </blockquote>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
