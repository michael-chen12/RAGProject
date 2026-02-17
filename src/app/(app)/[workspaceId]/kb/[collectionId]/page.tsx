import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { requireAuth, requireWorkspaceMember } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { getCollection } from '@/lib/queries/collections'
import { getDocumentsByCollection } from '@/lib/queries/documents'
import { DocumentRow } from '@/components/kb/document-row'

type PageProps = { params: Promise<{ workspaceId: string; collectionId: string }> }

export async function generateMetadata({ params }: PageProps) {
  const { collectionId } = await params
  const supabase = await createClient()
  const collection = await getCollection(supabase, collectionId)
  return { title: collection?.name ?? 'Collection' }
}

export default async function CollectionPage({ params }: PageProps) {
  const { workspaceId, collectionId } = await params

  // ── Auth + RBAC ──────────────────────────────────────────────────────────
  const user = await requireAuth()
  const supabase = await createClient()
  const membership = await requireWorkspaceMember(supabase, workspaceId, user.id)
  const role = membership.role

  // ── Parallel fetch (required by acceptance criteria) ──────────────────────
  const [collection, documents] = await Promise.all([
    getCollection(supabase, collectionId),
    getDocumentsByCollection(supabase, collectionId),
  ])

  if (!collection || collection.workspace_id !== workspaceId) notFound()

  // Viewers can't see private collections — redirect to KB overview
  if (collection.visibility === 'private' && role === 'viewer') {
    redirect(`/${workspaceId}/kb`)
  }

  const isAdmin = role === 'admin'
  const canUpload = role === 'admin' || role === 'agent'

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-400 mb-6" aria-label="Breadcrumb">
        <Link href={`/${workspaceId}/kb`} className="hover:text-gray-600 transition-colors">
          Knowledge Base
        </Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">{collection.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-semibold text-gray-900">{collection.name}</h1>
            <span
              className={`inline-flex items-center text-xs font-medium rounded-full px-2 py-0.5 ${
                collection.visibility === 'private'
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {collection.visibility === 'private' ? '🔒 Private' : 'Public'}
            </span>
          </div>
          <p className="text-sm text-gray-400">
            {documents.length === 1 ? '1 document' : `${documents.length} documents`}
          </p>
        </div>

        {/* Upload link — agent and admin only */}
        {canUpload && (
          <Link
            href={`/${workspaceId}/kb/upload`}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 transition-colors"
          >
            <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            Upload Document
          </Link>
        )}
      </div>

      {/* Document table */}
      {documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 border border-dashed border-gray-200 rounded-lg">
          <p className="text-sm text-gray-400">No documents in this collection yet.</p>
          {canUpload && (
            <Link
              href={`/${workspaceId}/kb/upload`}
              className="text-sm font-medium text-gray-900 hover:underline"
            >
              Upload a document →
            </Link>
          )}
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 pr-4 pl-4">
                  Filename
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 pr-4">
                  Status
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 pr-4">
                  Tokens
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 pr-4">
                  Uploaded
                </th>
                <th className="py-3 pr-4" />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {documents.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  document={doc}
                  workspaceId={workspaceId}
                  canDelete={isAdmin}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
