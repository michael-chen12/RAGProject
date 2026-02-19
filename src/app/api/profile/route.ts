import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withErrorHandler } from '@/lib/api/with-error-handler'
import { Errors } from '@/lib/api/errors'
import { setLogContext } from '@/lib/api/logger'

// GET /api/profile — get the current user's profile
async function handleGet(req: NextRequest) {
  const requestId = req.headers.get('x-internal-request-id') ?? ''
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw Errors.unauthorized()
  setLogContext(requestId, { userId: user.id })

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return NextResponse.json(data)
}

// PATCH /api/profile — update first_name and/or last_name
async function handlePatch(req: NextRequest) {
  const requestId = req.headers.get('x-internal-request-id') ?? ''
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw Errors.unauthorized()
  setLogContext(requestId, { userId: user.id })

  let updates: { first_name?: string; last_name?: string }
  try {
    updates = await req.json()
  } catch {
    throw Errors.invalidJson()
  }

  // Whitelist — only allow updating display name fields
  const allowedUpdates: typeof updates = {}
  if (typeof updates.first_name === 'string') {
    allowedUpdates.first_name = updates.first_name.trim()
  }
  if (typeof updates.last_name === 'string') {
    allowedUpdates.last_name = updates.last_name.trim()
  }

  if (Object.keys(allowedUpdates).length === 0) {
    throw Errors.validation('No valid fields to update')
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(allowedUpdates)
    .eq('id', user.id)
    .select()
    .single()

  if (error) throw Errors.internal('Failed to update profile')

  return NextResponse.json(data)
}

export const GET = withErrorHandler(handleGet)
export const PATCH = withErrorHandler(handlePatch)
