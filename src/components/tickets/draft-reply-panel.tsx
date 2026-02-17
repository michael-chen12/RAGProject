'use client'

import { useState } from 'react'
import type { Tables } from '@/types/database.types'
import type { CitationEntry } from '@/lib/rag/prompt'

type Ticket = Tables<'tickets'>

interface DraftReplyPanelProps {
  ticket: Ticket
  workspaceId: string
}

/**
 * Parses a custom SSE stream from /api/chat and separates:
 * - Regular token events: `data: <token_text>\n\n`
 * - Citations event:      `data: [CITATIONS]{...json...}\n\n`
 *
 * This is intentionally inline (not extracted to a hook) so we don't
 * risk breaking the existing use-chat-stream.ts tests.
 *
 * TODO (Learning Opportunity): Implement this function.
 *
 * The function receives a ReadableStreamDefaultReader<Uint8Array> from
 * the fetch response body. Your job is to:
 *
 * 1. Read chunks in a `while (true)` loop using reader.read()
 * 2. Decode each chunk with TextDecoder
 * 3. Split the accumulated buffer on '\n\n' to extract complete SSE events
 * 4. For each event that starts with 'data: ':
 *    - If the data starts with '[CITATIONS]', parse the JSON that follows
 *      and call onCitations(citations)
 *    - Otherwise, call onToken(data) to accumulate the answer text
 * 5. When `done === true`, break the loop
 *
 * Key trade-off to consider: Should you buffer partial chunks in a string
 * variable, or process each decode result independently? (Hint: SSE events
 * split across TCP packets would arrive as partial chunks — buffering is safer.)
 *
 * @param reader  - The stream reader from `response.body.getReader()`
 * @param onToken - Called with each text token as it arrives
 * @param onCitations - Called once with the citations array at end of stream
 */
async function parseSseStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onToken: (token: string) => void,
  onCitations: (citations: CitationEntry[]) => void
): Promise<void> {
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    // Decode the incoming binary chunk and append to buffer
    buffer += decoder.decode(value, { stream: true })

    // SSE events are separated by '\n\n'
    const events = buffer.split('\n\n')
    // Keep the last partial event in the buffer
    buffer = events.pop() ?? ''

    for (const event of events) {
      if (!event.startsWith('data: ')) continue
      const data = event.slice('data: '.length)

      if (data.startsWith('[CITATIONS]')) {
        try {
          const citations = JSON.parse(data.slice('[CITATIONS]'.length)) as CitationEntry[]
          onCitations(citations)
        } catch {
          // Malformed citations — safe to ignore
        }
      } else {
        onToken(data)
      }
    }
  }
}

export function DraftReplyPanel({ ticket, workspaceId }: DraftReplyPanelProps) {
  const [replyText, setReplyText] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [missingInfoSent, setMissingInfoSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDraftReply() {
    setDrafting(true)
    setError(null)
    setReplyText('')

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          message: ticket.title,
          ephemeral: true,  // No thread created, no messages persisted
        }),
      })

      if (!response.ok || !response.body) {
        setError('Failed to generate draft reply.')
        return
      }

      const reader = response.body.getReader()
      let fullAnswer = ''
      let citationEntries: CitationEntry[] = []

      await parseSseStream(
        reader,
        (token) => { fullAnswer += token },
        (citations) => { citationEntries = citations }
      )

      // Build the sources string from citation entries
      const sources = citationEntries.length > 0
        ? citationEntries.map((c, i) => `[${i + 1}] ${c.filename}`).join(', ')
        : 'No sources found'

      // Pre-fill the textarea with a professional reply template
      setReplyText(`Hi,\n\n${fullAnswer}\n\nSources: ${sources}\n\nBest regards`)
    } catch {
      setError('An error occurred while generating the draft.')
    } finally {
      setDrafting(false)
    }
  }

  async function handleMarkMissing() {
    setMissingInfoSent(true)
    try {
      await fetch(`/api/tickets/${ticket.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, action: 'mark_missing' }),
      })
    } catch {
      // Non-critical — button stays disabled regardless
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          onClick={handleDraftReply}
          disabled={drafting}
          className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {drafting ? 'Drafting…' : 'Draft Reply'}
        </button>
        <button
          onClick={handleMarkMissing}
          disabled={missingInfoSent}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {missingInfoSent ? 'Flagged' : 'Mark as Missing Info'}
        </button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {replyText && (
        <div>
          <label htmlFor="draft-reply" className="text-xs font-medium text-gray-500 block mb-1">
            Draft Reply
          </label>
          <textarea
            id="draft-reply"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            rows={8}
            className="w-full text-sm border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
        </div>
      )}
    </div>
  )
}
