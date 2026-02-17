import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getMembership } from '@/lib/queries/workspaces'
import { getDocument } from '@/lib/queries/documents'
import { requireRole } from '@/lib/auth/guards'

type RouteContext = { params: Promise<{ id: string; documentId: string }> }

/**
 * GET /api/workspaces/[id]/documents/[documentId]
 *
 * Returns the document row including its current status. Used by the upload
 * dropzone to poll for ingestion progress (every 3 s until indexed | failed).
 * RLS on `documents` ensures the caller can only see their own workspace's rows.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { documentId } = await params

  const userSupabase = await createClient()
  const {
    data: { user },
  } = await userSupabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const doc = await getDocument(userSupabase, documentId)

  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  return NextResponse.json(doc)
}

/**
 * DELETE /api/workspaces/[id]/documents/[documentId]
 *
 * Deletes a document. Requires admin role.
 *
 * Delete order is critical:
 *   1. Delete the DB row first (document_chunks cascade automatically via FK)
 *   2. Then delete the Storage file
 * If reversed and Storage fails, we'd have a DB row pointing to a missing file.
 * If Storage fails after DB delete, we log the error but return 200 (DB is source of truth).
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { id: workspaceId, documentId } = await params

  const userSupabase = await createClient()
  const {
    data: { user },
  } = await userSupabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const membership = await getMembership(userSupabase, workspaceId, user.id)
  if (!membership) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }

  try {
    requireRole(membership.role, 'admin')
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // RLS on documents ensures user can only see their workspace's rows
  const doc = await getDocument(userSupabase, documentId)
  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }
  // Defense in depth: verify workspace ownership explicitly
  if (doc.workspace_id !== workspaceId) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  const service = createServiceClient()

  // Step 1: Delete DB row (document_chunks cascade via FK ON DELETE CASCADE)
  const { error: dbError } = await service.from('documents').delete().eq('id', documentId)
  if (dbError) {
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 })
  }

  // Step 2: Delete the file from Storage (DB already deleted — log any error, don't fail)
  const { error: storageError } = await service.storage
    .from('documents')
    .remove([doc.storage_path])

  if (storageError) {
    console.error(
      `Storage delete failed for document ${documentId} (path: ${doc.storage_path}):`,
      storageError.message
    )
    // Return success anyway — DB is source of truth
  }

  return NextResponse.json({ success: true })
}
