import { redirect } from 'next/navigation'
import { requireAuth, requireWorkspaceMember } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { MembersList } from '@/components/settings/members-list'
import { InvitationsList } from '@/components/settings/invitations-list'
import { InviteForm } from '@/components/settings/invite-form'

type PageProps = { params: Promise<{ workspaceId: string }> }

export const metadata = { title: 'Settings' }

export default async function SettingsPage({ params }: PageProps) {
  const { workspaceId } = await params

  const user = await requireAuth()
  const supabase = await createClient()
  const membership = await requireWorkspaceMember(supabase, workspaceId, user.id)

  // Admin-only page — non-admins get redirected back to the workspace root
  if (membership.role !== 'admin') {
    redirect(`/${workspaceId}`)
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-xl font-semibold text-gray-900 mb-8">Settings</h1>

      <div className="space-y-10">
        {/* Members Section */}
        <section>
          <h2 className="text-sm font-medium text-gray-900 mb-4">Members</h2>
          <MembersList workspaceId={workspaceId} currentUserId={user.id} />
        </section>

        {/* Pending Invitations Section */}
        <section>
          <h2 className="text-sm font-medium text-gray-900 mb-4">Pending Invitations</h2>
          <InvitationsList workspaceId={workspaceId} />
        </section>

        {/* Invite Form */}
        <section>
          <h2 className="text-sm font-medium text-gray-900 mb-4">Invite Member</h2>
          <InviteForm workspaceId={workspaceId} />
        </section>
      </div>
    </div>
  )
}
