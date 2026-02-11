'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { useWorkspaceRole } from '@/components/layout/workspace-role-provider'
import { WorkspaceSwitcher } from '@/components/layout/workspace-switcher'
import { UserMenu } from '@/components/layout/user-menu'
import type { User } from '@supabase/supabase-js'
import type { Tables } from '@/types/database.types'

type Workspace = Tables<'workspaces'>

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
}

function BookIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  )
}

function TicketIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )
}

function CogIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

export function Sidebar({
  workspaces,
  user,
}: {
  workspaces: Workspace[]
  user: User
}) {
  const params = useParams()
  const pathname = usePathname()
  const role = useWorkspaceRole()
  const workspaceId = params?.workspaceId as string | undefined

  const navItems: NavItem[] = []

  if (workspaceId) {
    navItems.push(
      { label: 'Knowledge Base', href: `/${workspaceId}/kb`, icon: <BookIcon /> },
      { label: 'Chat', href: `/${workspaceId}/chat`, icon: <ChatIcon /> }
    )

    if (role === 'agent' || role === 'admin') {
      navItems.push({ label: 'Tickets', href: `/${workspaceId}/tickets`, icon: <TicketIcon /> })
    }

    if (role === 'admin') {
      navItems.push(
        { label: 'Eval', href: `/${workspaceId}/eval`, icon: <ChartIcon /> },
        { label: 'Settings', href: `/${workspaceId}/settings`, icon: <CogIcon /> }
      )
    }
  }

  return (
    <aside className="flex flex-col w-56 shrink-0 h-screen bg-white border-r border-neutral-200">
      {/* Workspace switcher */}
      <div className="pt-4 pb-2">
        <WorkspaceSwitcher workspaces={workspaces} />
      </div>

      {/* Nav */}
      {navItems.length > 0 && (
        <nav className="flex-1 px-3 py-2 space-y-0.5" aria-label="Workspace navigation">
          {navItems.map((item) => {
            const isActive = pathname?.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-neutral-100 text-neutral-900 font-medium'
                    : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                {item.icon}
                {item.label}
              </Link>
            )
          })}
        </nav>
      )}

      {/* Spacer when no workspace selected */}
      {navItems.length === 0 && <div className="flex-1" />}

      {/* User menu at bottom */}
      <UserMenu user={user} />
    </aside>
  )
}
