'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  evalSetId: string
  workspaceId: string
  totalCases: number
}

interface ProgressEvent {
  type: 'progress'
  current: number
  total: number
}

interface CompleteEvent {
  type: 'complete'
  runId: string
  recall_at_k: number
  answer_accuracy: number
  total: number
}

interface ErrorEvent {
  type: 'error'
  message: string
}

type StreamEvent = ProgressEvent | CompleteEvent | ErrorEvent

export function EvalRunButton({ evalSetId, workspaceId, totalCases }: Props) {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleRun() {
    setRunning(true)
    setProgress({ current: 0, total: totalCases })
    setError(null)

    try {
      const response = await fetch('/api/eval/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evalSetId, workspaceId }),
      })

      if (!response.ok || !response.body) {
        const err = await response.json().catch(() => ({ error: 'Request failed' }))
        setError((err as { error: string }).error)
        return
      }

      // Read NDJSON stream
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? '' // keep incomplete last line

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const event = JSON.parse(line) as StreamEvent
            if (event.type === 'progress') {
              setProgress({ current: event.current + 1, total: event.total })
            } else if (event.type === 'complete') {
              setProgress({ current: event.total, total: event.total })
              router.refresh()
            } else if (event.type === 'error') {
              setError(event.message)
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error')
    } finally {
      setRunning(false)
      setProgress(null)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleRun}
        disabled={running}
        className="px-3 py-1.5 text-sm font-medium rounded-md bg-neutral-900 text-white hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {running ? 'Running...' : 'Run'}
      </button>

      {running && progress && (
        <span className="text-xs text-neutral-500">
          {progress.current} / {progress.total} cases
        </span>
      )}

      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}
