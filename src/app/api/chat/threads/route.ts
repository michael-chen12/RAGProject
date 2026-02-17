import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse workspaceId from query string
  const { searchParams } = new URL(request.url)
  const workspaceId = searchParams.get('workspaceId')
  if (!workspaceId) {
    return Response.json({ error: 'workspaceId query parameter is required' }, { status: 400 })
  }

  // Membership check — verifies the user belongs to this workspace
  const { data: membership } = await supabase
    .from('memberships')
    .select('workspace_id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch threads for this user + workspace, newest first
  const { data: threads } = await supabase
    .from('chat_threads')
    .select('id, title, created_at')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return Response.json({ threads: threads ?? [] })
}
