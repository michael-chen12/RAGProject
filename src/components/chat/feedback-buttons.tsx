'use client'

import { useState } from 'react'

interface FeedbackButtonsProps {
  messageId: string
}

type Rating = 'up' | 'down' | null

/**
 * Thumbs up/down feedback buttons for assistant messages.
 * Uses optimistic updates — the UI changes immediately on click,
 * before the server confirms. Buttons are disabled after voting.
 */
export function FeedbackButtons({ messageId }: FeedbackButtonsProps) {
  const [rating, setRating] = useState<Rating>(null)
  const [isPending, setIsPending] = useState(false)

  async function handleFeedback(newRating: 'up' | 'down') {
    if (rating !== null || isPending) return

    setRating(newRating) // Optimistic update
    setIsPending(true)

    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, rating: newRating }),
      })
    } catch {
      // On failure, revert the optimistic update
      setRating(null)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="flex items-center gap-1 mt-1.5 ml-1">
      <button
        onClick={() => handleFeedback('up')}
        disabled={rating !== null}
        aria-label="Helpful"
        aria-pressed={rating === 'up'}
        className={`p-1 rounded hover:bg-gray-100 transition-colors
                    ${rating === 'up' ? 'text-green-600' : 'text-gray-400 hover:text-gray-600'}
                    disabled:cursor-not-allowed`}
      >
        <svg className="w-4 h-4" fill={rating === 'up' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
        </svg>
      </button>

      <button
        onClick={() => handleFeedback('down')}
        disabled={rating !== null}
        aria-label="Not helpful"
        aria-pressed={rating === 'down'}
        className={`p-1 rounded hover:bg-gray-100 transition-colors
                    ${rating === 'down' ? 'text-red-500' : 'text-gray-400 hover:text-gray-600'}
                    disabled:cursor-not-allowed`}
      >
        <svg className="w-4 h-4" fill={rating === 'down' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018c.163 0 .326.02.485.06L17 4m-7 10v2a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
        </svg>
      </button>
    </div>
  )
}
