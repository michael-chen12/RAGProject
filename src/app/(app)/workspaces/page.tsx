import Link from 'next/link'
import { requireAuth } from '@/lib/auth/guards'
import { getWorkspacesForUser } from '@/lib/queries/workspaces'
import { createClient } from '@/lib/supabase/server'

/**
 * Workspace list page — the landing page after login.
 * Shows all workspaces the user belongs to and their role in each.
 */
export default async function WorkspacesPage() {
  const user = await requireAuth()
  const supabase = await createClient()
  const workspaces = await getWorkspacesForUser(supabase)

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Your Workspaces</h1>
          <p className="text-sm text-neutral-500 mt-0.5">{user.email}</p>
        </div>
        <Link
          href="/workspaces/new"
          className="px-3 py-1.5 text-sm bg-neutral-900 text-white rounded-md hover:bg-neutral-700 transition-colors"
        >
          New Workspace
        </Link>
      </div>

      {workspaces.length === 0 ? (
        <div className="text-center py-16 text-neutral-400">
          <p className="text-base">No workspaces yet.</p>
          <p className="text-sm mt-1">
            <Link href="/workspaces/new" className="underline hover:text-neutral-600">
              Create your first workspace
            </Link>{' '}
            to get started.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {workspaces.map((ws) => (
            <li key={ws.id}>
              <Link
                href={`/${ws.id}`}
                className="flex items-center justify-between p-4 bg-white border border-neutral-200 rounded-lg hover:border-neutral-300 hover:shadow-sm transition-all group"
              >
                <div>
                  <p className="font-medium text-neutral-900 group-hover:text-neutral-700">
                    {ws.name}
                  </p>
                  <p className="text-xs text-neutral-400 mt-0.5">{ws.slug}</p>
                </div>
                <span className="text-xs text-neutral-400 capitalize bg-neutral-50 border border-neutral-200 rounded px-2 py-0.5">
                  {ws.membership.role}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
