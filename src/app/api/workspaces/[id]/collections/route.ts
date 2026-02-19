import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getMembership } from '@/lib/queries/workspaces'
import { getCollections } from '@/lib/queries/collections'
import { requireRole } from '@/lib/auth/guards'
import { withErrorHandler } from '@/lib/api/with-error-handler'
import { Errors } from '@/lib/api/errors'
import { setLogContext } from '@/lib/api/logger'

type RouteContext = { params?: Promise<Record<string, string>> }

async function handleGet(req: NextRequest, { params }: RouteContext) {
  const { id: workspaceId } = ((await params) ?? {}) as Record<string, string>
  const requestId = req.headers.get('x-internal-request-id') ?? ''

  const userSupabase = await createClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) throw Errors.unauthorized()
  setLogContext(requestId, { userId: user.id, workspaceId })

  const membership = await getMembership(userSupabase, workspaceId, user.id)
  if (!membership) throw Errors.notFound('Workspace not found')

  const collections = await getCollections(userSupabase, workspaceId, membership.role)
  return NextResponse.json(collections)
}

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

  let name: string, visibility: 'public' | 'private'
  try {
    const body = await req.json()
    name = (body.name ?? '').trim()
    visibility = body.visibility === 'private' ? 'private' : 'public'
  } catch {
    throw Errors.invalidJson()
  }

  if (!name) throw Errors.validation('name is required')

  const service = createServiceClient()
  const { data: collection, error } = await service
    .from('collections')
    .insert({ workspace_id: workspaceId, name, visibility })
    .select('*')
    .single()

  if (error || !collection) throw Errors.internal('Failed to create collection')

  return NextResponse.json(collection, { status: 201 })
}

export const GET = withErrorHandler(handleGet)
export const POST = withErrorHandler(handlePost)
