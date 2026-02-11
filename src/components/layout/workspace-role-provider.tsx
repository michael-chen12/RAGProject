'use client'

import { createContext, useContext } from 'react'
import type { Enums } from '@/types/database.types'

type MemberRole = Enums<'member_role'>

const WorkspaceRoleContext = createContext<MemberRole | undefined>(undefined)

/**
 * Thin Client Component wrapper that makes the current user's workspace role
 * available to any Client Component in the [workspaceId] route tree.
 *
 * Usage: Server Component passes role as a prop; Client Components read via useWorkspaceRole().
 */
export function WorkspaceRoleProvider({
  role,
  children,
}: {
  role: MemberRole
  children: React.ReactNode
}) {
  return (
    <WorkspaceRoleContext.Provider value={role}>
      {children}
    </WorkspaceRoleContext.Provider>
  )
}

/**
 * Returns the current user's role within the active workspace.
 * Returns undefined when called outside a [workspaceId] route.
 */
export function useWorkspaceRole(): MemberRole | undefined {
  return useContext(WorkspaceRoleContext)
}
