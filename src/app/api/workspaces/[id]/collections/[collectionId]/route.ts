import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getMembership } from '@/lib/queries/workspaces'
import { getCollection } from '@/lib/queries/collections'
import { requireRole } from '@/lib/auth/guards'

type RouteContext = { params: Promise<{ id: string; collectionId: string }> }

/**
 * DELETE /api/workspaces/[id]/collections/[collectionId]
 *
 * Deletes a collection. Requires admin role.
 *
 * FK behavior: documents.collection_id has ON DELETE SET NULL, so documents
 * are NOT deleted — they become "uncollected" and reappear on the /kb page.
 * document_chunks are also preserved. Only the collection row is removed.
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { id: workspaceId, collectionId } = await params

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

  // Verify collection belongs to this workspace (RLS + explicit check)
  const collection = await getCollection(userSupabase, collectionId)
  if (!collection || collection.workspace_id !== workspaceId) {
    return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
  }

  const service = createServiceClient()
  const { error } = await service.from('collections').delete().eq('id', collectionId)

  if (error) {
    return NextResponse.json({ error: 'Failed to delete collection' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
