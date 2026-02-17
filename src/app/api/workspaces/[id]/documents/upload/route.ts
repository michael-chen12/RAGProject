import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getMembership } from '@/lib/queries/workspaces'
import { requireRole } from '@/lib/auth/guards'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/workspaces/[id]/documents/upload
 *
 * Returns a short-lived signed upload URL for Supabase Storage and creates a
 * document record in status 'processing'. The client uses the signed URL to PUT
 * the file directly to Storage (so the file bytes never hit this server), then
 * calls POST /api/ingest/[documentId] to trigger processing.
 *
 * Body: { filename: string; contentType: string; collectionId?: string }
 * Response: { signedUploadUrl: string; documentId: string }
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { id: workspaceId } = await params

  // 1. Auth check — user client (respects RLS, never exposes service key)
  const userSupabase = await createClient()
  const {
    data: { user },
  } = await userSupabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. RBAC — only admin or agent may upload documents
  const membership = await getMembership(userSupabase, workspaceId, user.id)
  if (!membership) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }
  try {
    requireRole(membership.role, 'agent')
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 3. Parse request body
  let filename: string, contentType: string, collectionId: string | null
  try {
    const body = await req.json()
    filename = (body.filename ?? '').trim()
    contentType = (body.contentType ?? 'application/octet-stream').trim()
    collectionId = body.collectionId ?? null
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!filename) {
    return NextResponse.json({ error: 'filename is required' }, { status: 400 })
  }

  // 4. Build private storage path — never guessable by clients
  const storagePath = `workspaces/${workspaceId}/${crypto.randomUUID()}/${filename}`

  // 5. Service client for all writes (bypasses RLS, never sent to browser)
  const service = createServiceClient()

  // 6. Generate a 1-hour signed upload URL — client uploads directly to Storage
  const { data: signedData, error: signedError } = await service.storage
    .from('documents')
    .createSignedUploadUrl(storagePath, { upsert: false })

  if (signedError || !signedData) {
    return NextResponse.json({ error: 'Failed to create upload URL' }, { status: 500 })
  }

  // 7. Insert document record in 'processing' status
  const { data: doc, error: docError } = await service
    .from('documents')
    .insert({
      workspace_id: workspaceId,
      user_id: user.id,
      filename,
      storage_path: storagePath,
      status: 'processing' as const,
      collection_id: collectionId,
    })
    .select('id')
    .single()

  if (docError || !doc) {
    return NextResponse.json({ error: 'Failed to create document record' }, { status: 500 })
  }

  return NextResponse.json({
    signedUploadUrl: signedData.signedUrl,
    documentId: doc.id,
  })
}
