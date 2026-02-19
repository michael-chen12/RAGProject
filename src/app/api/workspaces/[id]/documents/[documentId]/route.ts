import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getMembership } from '@/lib/queries/workspaces'
import { getDocument } from '@/lib/queries/documents'
import { requireRole } from '@/lib/auth/guards'
import { withErrorHandler } from '@/lib/api/with-error-handler'
import { Errors } from '@/lib/api/errors'
import { setLogContext } from '@/lib/api/logger'
import logger from '@/lib/api/logger'

type RouteContext = { params?: Promise<Record<string, string>> }

async function handleGet(req: NextRequest, { params }: RouteContext) {
  const { documentId } = ((await params) ?? {}) as Record<string, string>
  const requestId = req.headers.get('x-internal-request-id') ?? ''

  const userSupabase = await createClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) throw Errors.unauthorized()
  setLogContext(requestId, { userId: user.id })

  const doc = await getDocument(userSupabase, documentId)
  if (!doc) throw Errors.notFound('Document not found')

  return NextResponse.json(doc)
}

async function handleDelete(req: NextRequest, { params }: RouteContext) {
  const { id: workspaceId, documentId } = ((await params) ?? {}) as Record<string, string>
  const requestId = req.headers.get('x-internal-request-id') ?? ''

  const userSupabase = await createClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) throw Errors.unauthorized()
  setLogContext(requestId, { userId: user.id, workspaceId })

  const membership = await getMembership(userSupabase, workspaceId, user.id)
  if (!membership) throw Errors.notFound('Workspace not found')

  try {
    requireRole(membership.role, 'admin')
  } catch {
    throw Errors.forbidden()
  }

  const doc = await getDocument(userSupabase, documentId)
  if (!doc) throw Errors.notFound('Document not found')
  if (doc.workspace_id !== workspaceId) throw Errors.notFound('Document not found')

  const service = createServiceClient()

  // Step 1: Delete DB row (document_chunks cascade via FK ON DELETE CASCADE)
  const { error: dbError } = await service.from('documents').delete().eq('id', documentId)
  if (dbError) throw Errors.internal('Failed to delete document')

  // Step 2: Delete the file from Storage (DB already deleted — log any error, don't fail)
  const { error: storageError } = await service.storage
    .from('documents')
    .remove([doc.storage_path])

  if (storageError) {
    logger.error(
      { documentId, storagePath: doc.storage_path, err: storageError },
      'Storage delete failed after DB delete'
    )
    // Return success anyway — DB is source of truth
  }

  return NextResponse.json({ success: true })
}

export const GET = withErrorHandler(handleGet)
export const DELETE = withErrorHandler(handleDelete)
