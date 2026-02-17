import Link from 'next/link'
import { requireAuth, requireWorkspaceMember } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { getCollections } from '@/lib/queries/collections'
import { getUncollectedDocuments } from '@/lib/queries/documents'
import { CollectionCard } from '@/components/kb/collection-card'
import { CreateCollectionForm } from '@/components/kb/create-collection-form'
import { DocumentRow } from '@/components/kb/document-row'

type PageProps = { params: Promise<{ workspaceId: string }> }

export const metadata = { title: 'Knowledge Base' }

export default async function KBPage({ params }: PageProps) {
  const { workspaceId } = await params

  // ── Auth + RBAC ──────────────────────────────────────────────────────────
  // Server components get role from DB, never from client context
  const user = await requireAuth()
  const supabase = await createClient()
  const membership = await requireWorkspaceMember(supabase, workspaceId, user.id)
  const role = membership.role

  // ── Parallel fetch (required by acceptance criteria) ──────────────────────
  // Both queries are independent — run concurrently to halve wait time
  const [collections, uncollected] = await Promise.all([
    getCollections(supabase, workspaceId, role),
    getUncollectedDocuments(supabase, workspaceId),
  ])

  const isAdmin = role === 'admin'
  const canCreateOrUpload = role === 'admin' || role === 'agent'

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Knowledge Base</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {collections.length === 1
              ? '1 collection'
              : `${collections.length} collections`}
          </p>
        </div>

        {/* Action buttons — agent and admin only */}
        {canCreateOrUpload && (
          <div className="flex items-center gap-2">
            <Link
              href={`/${workspaceId}/kb/upload`}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              Upload Document
            </Link>
            <CreateCollectionForm workspaceId={workspaceId} />
          </div>
        )}
      </div>

      {/* Collections grid */}
      {collections.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 border border-dashed border-gray-200 rounded-lg mb-8">
          <p className="text-sm text-gray-400">No collections yet.</p>
          {canCreateOrUpload && (
            <p className="text-xs text-gray-400">
              Create a collection to organise your documents, or upload documents directly.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {collections.map((collection) => (
            <CollectionCard
              key={collection.id}
              collection={collection}
              workspaceId={workspaceId}
              canDelete={isAdmin}
            />
          ))}
        </div>
      )}

      {/* Uncollected documents section */}
      {uncollected.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-base font-medium text-gray-700">Uncollected Documents</h2>
            <span className="text-sm text-gray-400">({uncollected.length})</span>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            These documents are not assigned to a collection. They are still indexed and searchable.
          </p>
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
                {uncollected.map((doc) => (
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
        </section>
      )}
    </div>
  )
}
