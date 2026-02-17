// Server Component — renders inside a table, fetches no data itself
import Link from 'next/link'
import type { Tables } from '@/types/database.types'
import { DocumentStatusBadge } from '@/components/kb/document-status-badge'
import { DeleteDocumentButton } from '@/components/kb/delete-document-button'

type Document = Tables<'documents'>

interface DocumentRowProps {
  document: Document
  workspaceId: string
  /** Only admins see the delete button */
  canDelete: boolean
}

/**
 * A single row in the document table.
 * This is a Server Component — it renders static HTML with no client state.
 * DeleteDocumentButton is a Client Component but can be used here because
 * Next.js serializes Server Components to RSC payload and hydrates clients independently.
 */
export function DocumentRow({ document, workspaceId, canDelete }: DocumentRowProps) {
  const createdAt = new Date(document.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <tr className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
      {/* Filename — links to the document detail page */}
      <td className="py-3 pr-4">
        <Link
          href={`/${workspaceId}/kb/document/${document.id}`}
          className="text-sm font-medium text-gray-900 hover:text-gray-600 hover:underline truncate max-w-xs block"
          title={document.filename}
        >
          {document.filename}
        </Link>
      </td>

      {/* Status badge */}
      <td className="py-3 pr-4">
        <DocumentStatusBadge status={document.status} errorMessage={document.error_message} />
      </td>

      {/* Token count */}
      <td className="py-3 pr-4 text-sm text-gray-500 tabular-nums">
        {document.token_count != null
          ? document.token_count.toLocaleString()
          : '—'}
      </td>

      {/* Upload date */}
      <td className="py-3 pr-4 text-sm text-gray-400 whitespace-nowrap">
        {createdAt}
      </td>

      {/* Actions — delete button for admins */}
      <td className="py-3 text-right">
        {canDelete && (
          <DeleteDocumentButton
            documentId={document.id}
            workspaceId={workspaceId}
            collectionId={document.collection_id}
            compact
          />
        )}
      </td>
    </tr>
  )
}
