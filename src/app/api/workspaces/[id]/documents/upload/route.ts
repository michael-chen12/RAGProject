import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getMembership } from '@/lib/queries/workspaces'
import { requireRole } from '@/lib/auth/guards'
import { withErrorHandler } from '@/lib/api/with-error-handler'
import { Errors } from '@/lib/api/errors'
import { setLogContext } from '@/lib/api/logger'

type RouteContext = { params?: Promise<Record<string, string>> }

async function handlePost(req: NextRequest, { params }: RouteContext) {
  const { id: workspaceId } = ((await params) ?? {}) as Record<string, string>
  const requestId = req.headers.get('x-internal-request-id') ?? ''

  const userSupabase = await createClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) throw Errors.unauthorized()
  setLogContext(requestId, { userId: user.id, workspaceId })

  const membership = await getMembership(userSupabase, workspaceId, user.id)
  if (!membership) throw Errors.notFound('Workspace not found')

  try {
    requireRole(membership.role, 'agent')
  } catch {
    throw Errors.forbidden()
  }

  let filename: string, contentType: string, collectionId: string | null
  try {
    const body = await req.json()
    filename = (body.filename ?? '').trim()
    contentType = (body.contentType ?? 'application/octet-stream').trim()
    collectionId = body.collectionId ?? null
  } catch {
    throw Errors.invalidJson()
  }

  if (!filename) throw Errors.validation('filename is required')

  // Build private storage path — never guessable by clients
  const storagePath = `workspaces/${workspaceId}/${crypto.randomUUID()}/${filename}`

  const service = createServiceClient()

  // Generate a 1-hour signed upload URL — client uploads directly to Storage
  const { data: signedData, error: signedError } = await service.storage
    .from('documents')
    .createSignedUploadUrl(storagePath, { upsert: false })

  if (signedError || !signedData) throw Errors.internal('Failed to create upload URL')

  // Insert document record in 'processing' status
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

  if (docError || !doc) throw Errors.internal('Failed to create document record')

  return NextResponse.json({
    signedUploadUrl: signedData.signedUrl,
    documentId: doc.id,
  })
}

export const POST = withErrorHandler(handlePost)
