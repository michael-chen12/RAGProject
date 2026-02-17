/**
 * Unit tests for ticket query helpers.
 * Verifies: workspace filtering, cross-tenant prevention, ordering, empty results.
 */

// ── Mock react cache ───────────────────────────────────────────────────────────
jest.mock('react', () => ({
  cache: (fn: unknown) => fn,
}))

// ── Helper to build a chainable Supabase mock ──────────────────────────────────
// Mirrors the pattern in tests/unit/queries/chat.test.ts exactly.
function makeSupabaseMock(resolveWith: unknown) {
  const chain: Record<string, jest.Mock> = {}
  const methods = ['from', 'select', 'eq', 'order', 'single']
  for (const method of methods) {
    chain[method] = jest.fn().mockReturnValue(chain)
  }
  chain['then'] = jest.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolve(resolveWith))
  )
  return chain
}

import { getTickets, getTicket, getTicketMessages } from '@/lib/queries/tickets'

const WORKSPACE_ID = 'ws-test-abc'
const TICKET_ID = 'ticket-test-abc'

// ─────────────────────────────────────────────────────────────────────────────
describe('getTickets', () => {
  it('filters by workspace_id and orders newest first', async () => {
    const fakeTickets = [
      { id: 'ticket-2', workspace_id: WORKSPACE_ID, status: 'open', title: 'Bug #2', created_at: '2024-02-01', assigned_agent_id: null },
      { id: 'ticket-1', workspace_id: WORKSPACE_ID, status: 'resolved', title: 'Bug #1', created_at: '2024-01-01', assigned_agent_id: null },
    ]
    const mock = makeSupabaseMock({ data: fakeTickets })

    const result = await getTickets(mock as unknown as Parameters<typeof getTickets>[0], WORKSPACE_ID)

    expect(mock.from).toHaveBeenCalledWith('tickets')
    expect(mock.eq).toHaveBeenCalledWith('workspace_id', WORKSPACE_ID)
    expect(mock.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(result).toEqual(fakeTickets)
  })

  it('applies optional status filter', async () => {
    const fakeTickets = [
      { id: 'ticket-1', workspace_id: WORKSPACE_ID, status: 'open', title: 'Open bug', created_at: '2024-01-01', assigned_agent_id: null },
    ]
    const mock = makeSupabaseMock({ data: fakeTickets })

    const result = await getTickets(mock as unknown as Parameters<typeof getTickets>[0], WORKSPACE_ID, 'open')

    // Status eq filter is applied in addition to workspace_id
    expect(mock.eq).toHaveBeenCalledWith('workspace_id', WORKSPACE_ID)
    expect(mock.eq).toHaveBeenCalledWith('status', 'open')
    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('open')
  })

  it('returns empty array when no tickets found', async () => {
    const mock = makeSupabaseMock({ data: null })

    const result = await getTickets(mock as unknown as Parameters<typeof getTickets>[0], WORKSPACE_ID)

    expect(result).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('getTicket', () => {
  it('filters by BOTH ticketId AND workspaceId — cross-tenant prevention', async () => {
    const fakeTicket = {
      id: TICKET_ID,
      workspace_id: WORKSPACE_ID,
      status: 'open',
      title: 'Issue in login flow',
      created_at: '2024-01-15',
      assigned_agent_id: null,
    }
    const mock = makeSupabaseMock({ data: fakeTicket })

    const result = await getTicket(mock as unknown as Parameters<typeof getTicket>[0], TICKET_ID, WORKSPACE_ID)

    expect(mock.from).toHaveBeenCalledWith('tickets')
    // Critical: BOTH id AND workspace_id must be checked
    expect(mock.eq).toHaveBeenCalledWith('id', TICKET_ID)
    expect(mock.eq).toHaveBeenCalledWith('workspace_id', WORKSPACE_ID)
    expect(mock.single).toHaveBeenCalled()
    expect(result).toEqual(fakeTicket)
  })

  it('returns null when ticket belongs to different workspace (cross-tenant blocked)', async () => {
    // Simulate DB returning nothing because the workspaceId doesn't match
    const mock = makeSupabaseMock({ data: null })

    const result = await getTicket(mock as unknown as Parameters<typeof getTicket>[0], TICKET_ID, 'different-workspace')

    expect(result).toBeNull()
  })

  it('returns null when ticket not found', async () => {
    const mock = makeSupabaseMock({ data: null })

    const result = await getTicket(mock as unknown as Parameters<typeof getTicket>[0], 'nonexistent-id', WORKSPACE_ID)

    expect(result).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('getTicketMessages', () => {
  it('filters by ticket_id and orders chronologically (ascending)', async () => {
    const fakeMessages = [
      { id: 'msg-1', ticket_id: TICKET_ID, content: 'First message', author_id: 'user-1', created_at: '2024-01-15T10:00:00Z' },
      { id: 'msg-2', ticket_id: TICKET_ID, content: 'Reply', author_id: 'agent-1', created_at: '2024-01-15T10:05:00Z' },
    ]
    const mock = makeSupabaseMock({ data: fakeMessages })

    const result = await getTicketMessages(mock as unknown as Parameters<typeof getTicketMessages>[0], TICKET_ID)

    expect(mock.from).toHaveBeenCalledWith('ticket_messages')
    expect(mock.eq).toHaveBeenCalledWith('ticket_id', TICKET_ID)
    // Ascending = oldest first (chronological reading order)
    expect(mock.order).toHaveBeenCalledWith('created_at', { ascending: true })
    expect(result).toHaveLength(2)
    expect(result[0].content).toBe('First message')
  })

  it('returns empty array when no messages exist', async () => {
    const mock = makeSupabaseMock({ data: null })

    const result = await getTicketMessages(mock as unknown as Parameters<typeof getTicketMessages>[0], TICKET_ID)

    expect(result).toEqual([])
  })
})
