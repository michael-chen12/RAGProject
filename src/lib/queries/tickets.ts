import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Tables, Enums } from '@/types/database.types'

type Ticket = Tables<'tickets'>
type TicketMessage = Tables<'ticket_messages'>

/**
 * Lists all tickets for a workspace, newest first.
 * Optionally filters by status.
 * All agents/admins see ALL workspace tickets (collaborative model).
 */
export const getTickets = cache(
  async (
    supabase: SupabaseClient,
    workspaceId: string,
    status?: Enums<'ticket_status'>
  ): Promise<Ticket[]> => {
    let query = supabase
      .from('tickets')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data } = await query
    return data ?? []
  }
)

/**
 * Fetches a single ticket.
 * Requires BOTH ticketId AND workspaceId to match — defense-in-depth.
 * Prevents cross-tenant access even if an attacker guesses a ticket UUID.
 */
export const getTicket = cache(
  async (
    supabase: SupabaseClient,
    ticketId: string,
    workspaceId: string
  ): Promise<Ticket | null> => {
    const { data } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', ticketId)
      .eq('workspace_id', workspaceId)
      .single()

    return data ?? null
  }
)

/**
 * Fetches all messages for a ticket, in chronological order (oldest first).
 */
export const getTicketMessages = cache(
  async (
    supabase: SupabaseClient,
    ticketId: string
  ): Promise<TicketMessage[]> => {
    const { data } = await supabase
      .from('ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true })

    return data ?? []
  }
)
