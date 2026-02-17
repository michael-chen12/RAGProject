import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { requireAuth, requireWorkspaceMember } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { getDocument, getDocumentChunks } from '@/lib/queries/documents'
import { getCollection } from '@/lib/queries/collections'
import { DocumentStatusBadge } from '@/components/kb/document-status-badge'
import { ChunkViewer } from '@/components/kb/chunk-viewer'
import { DeleteDocumentButton } from '@/components/kb/delete-document-button'

type PageProps = { params: Promise<{ workspaceId: string; documentId: string }> }

export async function generateMetadata({ params }: PageProps) {
  const { documentId } = await params
  const supabase = await createClient()
  const doc = await getDocument(supabase, documentId)
  return { title: doc?.filename ?? 'Document Detail' }
}

export default async function DocumentDetailPage({ params }: PageProps) {
  const { workspaceId, documentId } = await params

  // ── Auth + RBAC ──────────────────────────────────────────────────────────
  // requireAuth() redirects to /login if not authenticated
  const user = await requireAuth()
  const supabase = await createClient()
  // requireWorkspaceMember() redirects to /workspaces if not a member
  const membership = await requireWorkspaceMember(supabase, workspaceId, user.id)
  const role = membership.role

  // ── Fetch document ────────────────────────────────────────────────────────
  const doc = await getDocument(supabase, documentId)
  if (!doc) notFound()
  // Defense in depth: explicitly verify workspace ownership
  if (doc.workspace_id !== workspaceId) notFound()

  // ── Collection visibility check ───────────────────────────────────────────
  // Viewers can't access documents in private collections
  if (doc.collection_id) {
    const collection = await getCollection(supabase, doc.collection_id)
    if (collection?.visibility === 'private' && role === 'viewer') {
      redirect(`/${workspaceId}/kb`)
    }
  }

  // ── Fetch chunks only if indexed ──────────────────────────────────────────
  // Skip the DB call entirely for processing/failed docs (no chunks exist yet)
  const chunks = doc.status === 'indexed' ? await getDocumentChunks(supabase, documentId) : []

  // ── Breadcrumb data ───────────────────────────────────────────────────────
  let collectionName: string | null = null
  if (doc.collection_id) {
    const collection = await getCollection(supabase, doc.collection_id)
    collectionName = collection?.name ?? null
  }

  const isAdmin = role === 'admin'

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-400 mb-6" aria-label="Breadcrumb">
        <Link href={`/${workspaceId}/kb`} className="hover:text-gray-600 transition-colors">
          Knowledge Base
        </Link>
        {doc.collection_id && collectionName && (
          <>
            <span>/</span>
            <Link
              href={`/${workspaceId}/kb/${doc.collection_id}`}
              className="hover:text-gray-600 transition-colors"
            >
              {collectionName}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-gray-700 font-medium truncate max-w-[200px]" title={doc.filename}>
          {doc.filename}
        </span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-gray-900 mb-2 break-words">
            {doc.filename}
          </h1>
          <div className="flex items-center gap-3 flex-wrap">
            <DocumentStatusBadge status={doc.status} errorMessage={doc.error_message} />
            {doc.token_count != null && (
              <span className="text-sm text-gray-400">
                {doc.token_count.toLocaleString()} tokens total
              </span>
            )}
            <span className="text-sm text-gray-400">
              {new Date(doc.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
        </div>

        {/* Delete button — admin only */}
        {isAdmin && (
          <DeleteDocumentButton
            documentId={doc.id}
            workspaceId={workspaceId}
            collectionId={doc.collection_id}
          />
        )}
      </div>

      {/* Status-conditional body */}
      {doc.status === 'processing' && (
        <div
          className="flex flex-col items-center justify-center gap-3 py-16 border border-dashed border-amber-300 rounded-lg bg-amber-50"
          role="status"
          aria-live="polite"
        >
          <svg
            className="animate-spin h-8 w-8 text-amber-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm font-medium text-amber-700">Indexing in progress…</p>
          <p className="text-xs text-amber-500">
            This page does not auto-refresh. Come back in a moment.
          </p>
        </div>
      )}

      {doc.status === 'failed' && (
        <div className="p-4 border border-red-200 rounded-lg bg-red-50" role="alert">
          <p className="text-sm font-medium text-red-700 mb-1">Indexing failed</p>
          {doc.error_message && (
            <p className="text-xs text-red-600 font-mono break-all">{doc.error_message}</p>
          )}
        </div>
      )}

      {doc.status === 'indexed' && (
        <div>
          <h2 className="text-base font-medium text-gray-700 mb-3">
            Chunks{' '}
            <span className="text-sm font-normal text-gray-400">({chunks.length})</span>
          </h2>
          <ChunkViewer chunks={chunks} />
        </div>
      )}
    </div>
  )
}
