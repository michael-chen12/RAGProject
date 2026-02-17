// Server Component — NO 'use client' directive.
// This component runs entirely on the server so it can use:
// - createServiceClient() which holds the secret service-role key
// - retrieveChunks() which calls the SECURITY DEFINER pgvector RPC
// It is rendered inside <Suspense> on the ticket detail page.

import { createServiceClient } from '@/lib/supabase/server'
import { embedText } from '@/lib/openai/embeddings'
import { retrieveChunks } from '@/lib/rag/retrieval'

interface AiSuggestionPanelProps {
  ticketTitle: string
  workspaceId: string
  ticketId: string
}

/** Skeleton shown while the Suspense boundary is streaming */
export function SuggestionSkeleton() {
  return (
    <div className="space-y-3" aria-label="Loading AI suggestions">
      {[0, 1, 2].map((i) => (
        <div key={i} className="animate-pulse rounded-lg border border-gray-100 p-3">
          <div className="h-3 bg-gray-200 rounded w-3/4 mb-2" />
          <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
          <div className="h-3 bg-gray-100 rounded w-full" />
        </div>
      ))}
    </div>
  )
}

/** Renders up to 3 most-similar KB chunks for the given ticket title */
export async function AiSuggestionPanel({ ticketTitle, workspaceId, ticketId: _ticketId }: AiSuggestionPanelProps) {
  if (!ticketTitle.trim()) {
    return (
      <p className="text-sm text-gray-400">No title to search.</p>
    )
  }

  let chunks
  try {
    const serviceClient = createServiceClient()
    // Lower threshold (0.4 vs 0.5 for chat): ticket titles are shorter than full
    // chat questions so cosine similarity is naturally lower even for relevant matches.
    const embedding = await embedText(ticketTitle)
    chunks = await retrieveChunks(serviceClient, workspaceId, embedding, {
      k: 3,
      threshold: 0.4,
    })
  } catch {
    return (
      <p className="text-sm text-red-500">Could not load suggestions. Please try again.</p>
    )
  }

  if (chunks.length === 0) {
    return (
      <p className="text-sm text-gray-400" data-testid="ai-suggestion-panel">
        No relevant KB articles found.
      </p>
    )
  }

  return (
    <div className="space-y-3" data-testid="ai-suggestion-panel">
      {chunks.map((chunk) => (
        <div key={chunk.id} className="rounded-lg border border-gray-100 p-3 bg-white">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <p className="text-xs font-medium text-gray-700 truncate">{chunk.filename}</p>
            <span className="shrink-0 text-xs text-gray-400">
              {(chunk.similarity * 100).toFixed(0)}% match
            </span>
          </div>
          <p className="text-xs text-gray-500 line-clamp-3">
            {chunk.chunkText.slice(0, 200)}
            {chunk.chunkText.length > 200 ? '…' : ''}
          </p>
        </div>
      ))}
    </div>
  )
}
