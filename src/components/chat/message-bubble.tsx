'use client'

import { CitationPill } from './citation-pill'
import type { CitationEntry } from '@/lib/rag/prompt'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  citations: CitationEntry[]
  isStreaming?: boolean
  onCitationClick: (citation: CitationEntry) => void
}

/**
 * Renders a single chat message bubble.
 *
 * For assistant messages:
 * - Scans for [N] patterns in the text
 * - Wraps matched citations in <CitationPill> components
 * - Shows an animated cursor while streaming
 *
 * For user messages: plain text in a right-aligned bubble.
 */
export function MessageBubble({
  role,
  content,
  citations,
  isStreaming = false,
  onCitationClick,
}: MessageBubbleProps) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm">
          {content}
        </div>
      </div>
    )
  }

  // Parse [N] citation markers and replace with CitationPill components
  const citationMap = new Map(citations.map((c) => [c.index, c]))
  const parts = content.split(/(\[\d+\])/g)

  const renderedContent = parts.map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/)
    if (match) {
      const index = parseInt(match[1], 10)
      const citation = citationMap.get(index)
      if (citation) {
        return (
          <CitationPill
            key={`citation-${i}`}
            index={index}
            onClick={() => onCitationClick(citation)}
          />
        )
      }
    }
    return <span key={`text-${i}`}>{part}</span>
  })

  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] bg-gray-100 text-gray-900 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed">
        {renderedContent}
        {/* Streaming cursor animation */}
        {isStreaming && (
          <span className="inline-block w-0.5 h-4 bg-gray-600 ml-0.5 animate-pulse align-middle" />
        )}
      </div>
    </div>
  )
}
