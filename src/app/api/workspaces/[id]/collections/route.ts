import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getMembership } from '@/lib/queries/workspaces'
import { getCollections } from '@/lib/queries/collections'
import { requireRole } from '@/lib/auth/guards'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/workspaces/[id]/collections
 *
 * Returns all collections the caller can see. Viewers only see public ones
 * (filtered in getCollections via app-layer, not RLS). Each collection
 * includes a doc_count of documents in it.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id: workspaceId } = await params

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

  const collections = await getCollections(userSupabase, workspaceId, membership.role)

  return NextResponse.json(collections)
}

/**
 * POST /api/workspaces/[id]/collections
 *
 * Creates a new collection in the workspace. Requires agent or admin role.
 *
 * Body: { name: string; visibility?: 'public' | 'private' }
 * Response: the newly created collection row (201)
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { id: workspaceId } = await params

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
    requireRole(membership.role, 'agent')
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let name: string, visibility: 'public' | 'private'
  try {
    const body = await req.json()
    name = (body.name ?? '').trim()
    // Default to public if not explicitly 'private'
    visibility = body.visibility === 'private' ? 'private' : 'public'
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  // Service client for the write (bypasses RLS, never exposed to browser)
  const service = createServiceClient()
  const { data: collection, error } = await service
    .from('collections')
    .insert({ workspace_id: workspaceId, name, visibility })
    .select('*')
    .single()

  if (error || !collection) {
    return NextResponse.json({ error: 'Failed to create collection' }, { status: 500 })
  }

  return NextResponse.json(collection, { status: 201 })
}
