'use client'

import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

export function UserMenu({ user }: { user: User }) {
  const router = useRouter()
  const supabase = getSupabaseBrowserClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-t border-neutral-200">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-neutral-500 truncate">{user.email}</p>
      </div>
      <button
        onClick={handleSignOut}
        className="text-xs text-neutral-400 hover:text-neutral-700 shrink-0"
        aria-label="Sign out"
      >
        Sign out
      </button>
    </div>
  )
}
