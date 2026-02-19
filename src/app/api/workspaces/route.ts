import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { withErrorHandler } from '@/lib/api/with-error-handler'
import { Errors } from '@/lib/api/errors'
import { setLogContext } from '@/lib/api/logger'

const SLUG_PATTERN = /^[a-z0-9-]+$/

async function handlePost(req: NextRequest) {
  const requestId = req.headers.get('x-internal-request-id') ?? ''
  const userSupabase = await createClient()
  const {
    data: { user },
  } = await userSupabase.auth.getUser()

  if (!user) throw Errors.unauthorized()
  setLogContext(requestId, { userId: user.id })

  let name: string, slug: string
  try {
    const body = await req.json()
    name = (body.name ?? '').trim()
    slug = (body.slug ?? '').trim()
  } catch {
    throw Errors.invalidJson()
  }

  if (!name) throw Errors.validation('Name is required')
  if (!slug) throw Errors.validation('Slug is required')
  if (!SLUG_PATTERN.test(slug)) {
    throw Errors.validation('Slug must contain only lowercase letters, numbers, and hyphens')
  }

  const service = createServiceClient()

  const { data: workspace, error: wsError } = await service
    .from('workspaces')
    .insert({ name, slug, created_by: user.id })
    .select('id, name, slug')
    .single()

  if (wsError) {
    if (wsError.code === '23505') throw Errors.conflict('Slug already taken')
    throw Errors.internal('Failed to create workspace')
  }

  const { error: memberError } = await service.from('memberships').insert({
    workspace_id: workspace.id,
    user_id: user.id,
    role: 'admin',
  })

  if (memberError) {
    // Cleanup orphaned workspace on member insert failure
    await service.from('workspaces').delete().eq('id', workspace.id)
    throw Errors.internal('Failed to create membership')
  }

  return NextResponse.json(workspace, { status: 201 })
}

export const POST = withErrorHandler(handlePost)
