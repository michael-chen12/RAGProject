import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getMembership } from '@/lib/queries/workspaces'
import { getCollection } from '@/lib/queries/collections'
import { requireRole } from '@/lib/auth/guards'
import { withErrorHandler } from '@/lib/api/with-error-handler'
import { Errors } from '@/lib/api/errors'
import { setLogContext } from '@/lib/api/logger'

type RouteContext = { params?: Promise<Record<string, string>> }

async function handleDelete(req: NextRequest, { params }: RouteContext) {
  const { id: workspaceId, collectionId } = ((await params) ?? {}) as Record<string, string>
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

  const collection = await getCollection(userSupabase, collectionId)
  if (!collection || collection.workspace_id !== workspaceId) {
    throw Errors.notFound('Collection not found')
  }

  const service = createServiceClient()
  const { error } = await service.from('collections').delete().eq('id', collectionId)
  if (error) throw Errors.internal('Failed to delete collection')

  return NextResponse.json({ success: true })
}

export const DELETE = withErrorHandler(handleDelete)
