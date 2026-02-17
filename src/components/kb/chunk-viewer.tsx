'use client'

import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { DocumentChunk } from '@/lib/queries/documents'

interface ChunkViewerProps {
  chunks: DocumentChunk[]
}

/**
 * Renders document chunks with virtualization via @tanstack/react-virtual.
 * Only ~20 DOM nodes are rendered at any time regardless of chunk count,
 * keeping the page fast even for documents with 500+ chunks.
 *
 * Key requirements for virtualization to work:
 *  1. Parent container MUST have a fixed height (h-[600px])
 *  2. Use item.key (not item.index) as the React key
 *  3. The inner div height must equal virtualizer.getTotalSize() (full virtual area)
 */
export function ChunkViewer({ chunks }: ChunkViewerProps) {
  // The scroll container — virtualization watches this element's scroll events
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: chunks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120, // estimated row height in px (actual measured after mount)
    overscan: 5,             // pre-render 5 extra rows above/below viewport
  })

  if (chunks.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg">
        No chunks found for this document.
      </div>
    )
  }

  return (
    <div
      ref={parentRef}
      className="h-[600px] overflow-auto border border-gray-200 rounded-lg"
      aria-label={`Chunk list — ${chunks.length} chunks`}
    >
      {/* Full virtual area — height equals total estimated height of all items */}
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const chunk = chunks[virtualItem.index]
          return (
            <div
              key={virtualItem.key}           // use item.key, NOT item.index
              data-index={virtualItem.index}
              ref={virtualizer.measureElement} // v3 API: enables dynamic height measurement
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <ChunkRow chunk={chunk} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Single chunk row — shows index, truncated text, and token count.
 */
function ChunkRow({ chunk }: { chunk: DocumentChunk }) {
  const preview =
    chunk.chunk_text.length > 200
      ? chunk.chunk_text.slice(0, 200) + '…'
      : chunk.chunk_text

  return (
    <div className="px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <span className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-xs font-mono text-gray-500">
          {chunk.chunk_index + 1}
        </span>
        <p className="flex-1 text-sm text-gray-700 leading-relaxed font-mono whitespace-pre-wrap break-words">
          {preview}
        </p>
        <span className="shrink-0 text-xs text-gray-400 whitespace-nowrap pt-0.5">
          {chunk.token_count?.toLocaleString() ?? '—'} tokens
        </span>
      </div>
    </div>
  )
}
