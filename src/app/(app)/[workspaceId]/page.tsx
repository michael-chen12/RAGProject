import { requireAuth } from '@/lib/auth/guards'
import { getWorkspace } from '@/lib/queries/workspaces'
import { createClient } from '@/lib/supabase/server'

/**
 * Workspace home page — dashboard stub (analytics implemented in TASK-008).
 */
export default async function WorkspaceHomePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params
  const user = await requireAuth()
  const supabase = await createClient()
  const workspace = await getWorkspace(supabase, workspaceId)

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-neutral-900">
        {workspace?.name ?? 'Workspace'}
      </h1>
      <p className="text-sm text-neutral-500 mt-1">
        Welcome back, {user.email}
      </p>
      <p className="mt-6 text-sm text-neutral-400">
        Dashboard analytics coming in TASK-008.
      </p>
    </div>
  )
}
