import { requireAuth } from '@/lib/auth/guards'
import { getWorkspacesForUser } from '@/lib/queries/workspaces'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'

/**
 * App shell layout for all authenticated routes.
 * Renders a persistent sidebar alongside the page content.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireAuth()
  const supabase = await createClient()
  const workspaces = await getWorkspacesForUser(supabase)

  // getWorkspacesForUser returns WorkspaceWithMembership[]; Sidebar only needs Workspace fields
  const workspaceList = workspaces.map(({ membership: _m, ...ws }) => ws)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar workspaces={workspaceList} user={user} />
      <main className="flex-1 overflow-y-auto bg-neutral-50">
        {children}
      </main>
    </div>
  )
}
