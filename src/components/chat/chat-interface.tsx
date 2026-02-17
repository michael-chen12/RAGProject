'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ThreadList } from './thread-list'
import { MessageBubble } from './message-bubble'
import { FeedbackButtons } from './feedback-buttons'
import { SourceDrawer } from './source-drawer'
import { useChatStream, type ChatMessage } from '@/hooks/use-chat-stream'
import type { CitationEntry } from '@/lib/rag/prompt'

interface ChatInterfaceProps {
  workspaceId: string
  initialThreadId: string | null
  initialMessages: ChatMessage[]
}

/**
 * Main chat interface component.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────┐
 *   │  ThreadList (sidebar) │  Message area         │
 *   │                       │  + input textarea     │
 *   └──────────────────────────────────────────────┘
 *
 * The SourceDrawer slides in from the right when a citation pill is clicked.
 * Auto-scrolls to the bottom when new tokens arrive during streaming.
 */
export function ChatInterface({
  workspaceId,
  initialThreadId,
  initialMessages,
}: ChatInterfaceProps) {
  const { messages, isStreaming, error, threadId, sendMessage } = useChatStream(initialMessages)
  const [selectedCitation, setSelectedCitation] = useState<CitationEntry | null>(null)
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new content
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault()
      const trimmed = inputValue.trim()
      if (!trimmed || isStreaming) return
      setInputValue('')
      await sendMessage(workspaceId, trimmed)
    },
    [inputValue, isStreaming, sendMessage, workspaceId]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  const currentThreadId = threadId ?? initialThreadId

  return (
    <div className="flex h-full overflow-hidden">
      {/* Thread sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-gray-200 bg-gray-50">
        <ThreadList workspaceId={workspaceId} currentThreadId={currentThreadId} />
      </aside>

      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <h3 className="text-gray-900 font-medium">Ask anything</h3>
              <p className="text-gray-500 text-sm mt-1">
                I&apos;ll answer using your knowledge base documents.
              </p>
            </div>
          )}

          {messages.map((msg, index) => {
            const isLastMessage = index === messages.length - 1
            const isStreamingThis = isLastMessage && msg.role === 'assistant' && isStreaming

            return (
              <div key={index} className="space-y-1">
                <MessageBubble
                  role={msg.role}
                  content={msg.content}
                  citations={msg.citations}
                  isStreaming={isStreamingThis}
                  onCitationClick={setSelectedCitation}
                />
                {/* Show feedback buttons for completed assistant messages */}
                {msg.role === 'assistant' && !isStreamingThis && msg.id && (
                  <FeedbackButtons messageId={msg.id} />
                )}
              </div>
            )
          })}

          {/* Error banner */}
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-gray-200 bg-white px-4 py-3">
          <form onSubmit={handleSubmit} className="flex gap-2 items-end">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your documents... (Enter to send, Shift+Enter for newline)"
              rows={1}
              disabled={isStreaming}
              className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-2.5
                         text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         disabled:bg-gray-50 disabled:text-gray-400
                         max-h-32 overflow-y-auto"
              style={{ minHeight: '42px' }}
            />
            <button
              type="submit"
              disabled={isStreaming || !inputValue.trim()}
              className="flex-shrink-0 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium
                         rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors"
            >
              {isStreaming ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Source citation drawer */}
      <SourceDrawer
        citation={selectedCitation}
        onClose={() => setSelectedCitation(null)}
      />
    </div>
  )
}
