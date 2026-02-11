import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const SLUG_PATTERN = /^[a-z0-9-]+$/

export async function POST(req: NextRequest) {
  // 1. Auth check — user client (respects RLS)
  const userSupabase = await createClient()
  const {
    data: { user },
  } = await userSupabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse and validate body
  let name: string, slug: string
  try {
    const body = await req.json()
    name = (body.name ?? '').trim()
    slug = (body.slug ?? '').trim()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }
  if (!slug) {
    return NextResponse.json({ error: 'Slug is required' }, { status: 400 })
  }
  if (!SLUG_PATTERN.test(slug)) {
    return NextResponse.json(
      { error: 'Slug must contain only lowercase letters, numbers, and hyphens' },
      { status: 400 }
    )
  }

  // 3. Service client for writes (bypasses RLS)
  const service = createServiceClient()

  // 4. Insert workspace
  const { data: workspace, error: wsError } = await service
    .from('workspaces')
    .insert({ name, slug, created_by: user.id })
    .select('id, name, slug')
    .single()

  if (wsError) {
    if (wsError.code === '23505') {
      return NextResponse.json({ error: 'Slug already taken' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to create workspace' }, { status: 500 })
  }

  // 5. Insert creator as admin member
  const { error: memberError } = await service.from('memberships').insert({
    workspace_id: workspace.id,
    user_id: user.id,
    role: 'admin',
  })

  if (memberError) {
    // Cleanup orphaned workspace on member insert failure
    await service.from('workspaces').delete().eq('id', workspace.id)
    return NextResponse.json({ error: 'Failed to create membership' }, { status: 500 })
  }

  return NextResponse.json(workspace, { status: 201 })
}
