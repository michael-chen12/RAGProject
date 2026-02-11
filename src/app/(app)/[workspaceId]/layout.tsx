import { requireAuth, requireWorkspaceMember } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { WorkspaceRoleProvider } from '@/components/layout/workspace-role-provider'

/**
 * Workspace-scoped layout. Validates that the current user is a member of
 * the workspace, then injects their role into context for all child components.
 */
export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params
  const user = await requireAuth()
  const supabase = await createClient()
  const membership = await requireWorkspaceMember(supabase, workspaceId, user.id)

  return (
    <WorkspaceRoleProvider role={membership.role}>
      {children}
    </WorkspaceRoleProvider>
  )
}
