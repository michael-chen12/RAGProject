'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'

type UploadStatus = 'idle' | 'uploading' | 'processing' | 'indexed' | 'failed'

interface UploadState {
  status: UploadStatus
  filename?: string
  errorMessage?: string
  documentId?: string
  chunkCount?: number
}

interface Props {
  workspaceId: string
  onIndexed?: (documentId: string) => void
}

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB
const POLL_INTERVAL_MS = 3000

const STATUS_LABELS: Record<UploadStatus, string> = {
  idle: 'Drop a PDF or TXT file here, or click to select',
  uploading: 'Uploading…',
  processing: 'Processing…',
  indexed: 'Indexed',
  failed: 'Failed',
}

const STEP_ORDER: UploadStatus[] = ['uploading', 'processing', 'indexed']

export function UploadDropzone({ workspaceId, onIndexed }: Props) {
  const [state, setState] = useState<UploadState>({ status: 'idle' })
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Stop polling when component unmounts
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const startPolling = useCallback(
    (documentId: string) => {
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(
            `/api/workspaces/${workspaceId}/documents/${documentId}`
          )
          if (!res.ok) return
          const doc = await res.json()

          if (doc.status === 'indexed') {
            clearInterval(pollRef.current!)
            setState((prev) => ({
              ...prev,
              status: 'indexed',
              chunkCount: undefined,
            }))
            onIndexed?.(documentId)
          } else if (doc.status === 'failed') {
            clearInterval(pollRef.current!)
            setState((prev) => ({
              ...prev,
              status: 'failed',
              errorMessage: doc.error_message ?? 'Ingestion failed',
            }))
          }
        } catch {
          // Network hiccup — keep polling
        }
      }, POLL_INTERVAL_MS)
    },
    [workspaceId, onIndexed]
  )

  const handleFile = useCallback(
    async (file: File) => {
      if (file.size > MAX_FILE_SIZE) {
        setState({ status: 'failed', filename: file.name, errorMessage: 'File exceeds 20 MB limit' })
        return
      }

      setState({ status: 'uploading', filename: file.name })

      try {
        // Step 1 — get signed upload URL from our API
        const uploadRes = await fetch(`/api/workspaces/${workspaceId}/documents/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, contentType: file.type }),
        })

        if (!uploadRes.ok) {
          const { error } = await uploadRes.json()
          throw new Error(error ?? 'Failed to get upload URL')
        }

        const { signedUploadUrl, documentId } = await uploadRes.json()

        // Step 2 — PUT file directly to Supabase Storage (service key never leaves server)
        const putRes = await fetch(signedUploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        })

        if (!putRes.ok) {
          throw new Error('Storage upload failed')
        }

        setState((prev) => ({ ...prev, status: 'processing', documentId }))

        // Step 3 — trigger ingestion pipeline (fire-and-move-to-polling)
        fetch(`/api/ingest/${documentId}`, { method: 'POST' }).catch(() => {
          // Errors will surface via polling
        })

        // Step 4 — poll for status updates
        startPolling(documentId)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed'
        setState((prev) => ({ ...prev, status: 'failed', errorMessage: message }))
      }
    },
    [workspaceId, startPolling]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted) => { if (accepted[0]) handleFile(accepted[0]) },
    accept: { 'application/pdf': ['.pdf'], 'text/plain': ['.txt'] },
    maxFiles: 1,
    disabled: state.status !== 'idle' && state.status !== 'failed',
  })

  const retry = () => {
    if (pollRef.current) clearInterval(pollRef.current)
    setState({ status: 'idle' })
  }

  const isActive = state.status !== 'idle' && state.status !== 'failed'

  return (
    <div className="space-y-4">
      {/* Dropzone area */}
      <div
        {...getRootProps()}
        className={[
          'border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors',
          isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400',
          isActive ? 'opacity-60 pointer-events-none' : '',
        ].join(' ')}
      >
        <input {...getInputProps()} />
        <p className="text-sm text-gray-600">{STATUS_LABELS[state.status]}</p>
        {state.filename && (
          <p className="mt-1 text-xs text-gray-500 font-mono">{state.filename}</p>
        )}
      </div>

      {/* Step indicator — shown while in progress */}
      {(state.status === 'uploading' ||
        state.status === 'processing' ||
        state.status === 'indexed') && (
        <ol className="flex items-center gap-3 text-sm">
          {STEP_ORDER.map((step) => {
            const currentIdx = STEP_ORDER.indexOf(state.status)
            const stepIdx = STEP_ORDER.indexOf(step)
            const done = stepIdx < currentIdx
            const active = stepIdx === currentIdx
            return (
              <li key={step} className="flex items-center gap-1.5">
                <span
                  className={[
                    'h-2 w-2 rounded-full',
                    done ? 'bg-green-500' : active ? 'bg-blue-500 animate-pulse' : 'bg-gray-300',
                  ].join(' ')}
                />
                <span className={active ? 'font-medium' : 'text-gray-400'}>
                  {step.charAt(0).toUpperCase() + step.slice(1)}
                </span>
                {stepIdx < STEP_ORDER.length - 1 && (
                  <span className="text-gray-300">→</span>
                )}
              </li>
            )
          })}
        </ol>
      )}

      {/* Error state */}
      {state.status === 'failed' && (
        <div className="flex items-start justify-between rounded-md bg-red-50 border border-red-200 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-red-700">Ingestion failed</p>
            {state.errorMessage && (
              <p className="mt-0.5 text-xs text-red-600">{state.errorMessage}</p>
            )}
          </div>
          <button
            onClick={retry}
            className="ml-4 shrink-0 text-xs font-medium text-red-700 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  )
}
