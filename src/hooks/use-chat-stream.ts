'use client'

import { useState, useRef, useCallback } from 'react'
import type { CitationEntry } from '@/lib/rag/prompt'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  citations: CitationEntry[]
  id?: string
}

interface UseChatStreamReturn {
  messages: ChatMessage[]
  isStreaming: boolean
  error: string | null
  threadId: string | null
  sendMessage: (workspaceId: string, message: string) => Promise<void>
  reset: () => void
}

/**
 * React hook that manages the streaming chat state.
 *
 * Protocol:
 *  - POST /api/chat → SSE stream
 *  - Each `data: <token>` event appends a token to the current assistant message
 *  - `data: [CITATIONS]{...}` sets citations for the current message
 *  - `X-Thread-Id` response header carries the thread ID (new or existing)
 *
 * Thread continuity: once a threadId is set from the first response header,
 * it is reused for all subsequent messages in the same hook instance.
 */
export function useChatStream(initialMessages: ChatMessage[] = []): UseChatStreamReturn {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [threadId, setThreadId] = useState<string | null>(null)
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)

  const sendMessage = useCallback(async (workspaceId: string, message: string) => {
    if (isStreaming) return

    setError(null)
    setIsStreaming(true)

    // Optimistically add the user message to the list
    const userMessage: ChatMessage = { role: 'user', content: message, citations: [] }
    setMessages((prev) => [...prev, userMessage])

    // Placeholder for the streaming assistant message
    const assistantMessage: ChatMessage = { role: 'assistant', content: '', citations: [] }
    setMessages((prev) => [...prev, assistantMessage])

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          message,
          threadId: threadId ?? undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Request failed' }))
        const retryAfter = response.headers.get('Retry-After')
        const msg = response.status === 429
          ? `Rate limited. Please wait ${retryAfter ?? 'a moment'} before sending again.`
          : (data.error ?? `Error ${response.status}`)
        throw new Error(msg)
      }

      // Capture thread ID from response header (set on first message, same thereafter)
      const newThreadId = response.headers.get('X-Thread-Id')
      if (newThreadId && !threadId) {
        setThreadId(newThreadId)
      }

      if (!response.body) throw new Error('No response body')

      const reader = response.body.getReader()
      readerRef.current = reader
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Process complete SSE lines (each ends with \n\n)
        const events = buffer.split('\n\n')
        // Keep the last (potentially incomplete) chunk in the buffer
        buffer = events.pop() ?? ''

        for (const event of events) {
          if (!event.startsWith('data: ')) continue
          const payload = event.slice('data: '.length)

          if (payload.startsWith('[CITATIONS]')) {
            // Parse citation map and attach to the last assistant message
            try {
              const citations: CitationEntry[] = JSON.parse(payload.slice('[CITATIONS]'.length))
              setMessages((prev) => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last?.role === 'assistant') {
                  updated[updated.length - 1] = { ...last, citations }
                }
                return updated
              })
            } catch {
              // Malformed citations — ignore, don't crash the stream
            }
          } else {
            // Regular token — append to the streaming assistant message
            setMessages((prev) => {
              const updated = [...prev]
              const last = updated[updated.length - 1]
              if (last?.role === 'assistant') {
                updated[updated.length - 1] = {
                  ...last,
                  content: last.content + payload,
                }
              }
              return updated
            })
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred'
      setError(message)
      // Remove the empty assistant placeholder on error
      setMessages((prev) => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        if (last?.role === 'assistant' && last.content === '') {
          updated.pop()
        }
        return updated
      })
    } finally {
      readerRef.current = null
      setIsStreaming(false)
    }
  }, [isStreaming, threadId])

  const reset = useCallback(() => {
    if (readerRef.current) {
      readerRef.current.cancel()
      readerRef.current = null
    }
    setMessages([])
    setIsStreaming(false)
    setError(null)
    setThreadId(null)
  }, [])

  return { messages, isStreaming, error, threadId, sendMessage, reset }
}
