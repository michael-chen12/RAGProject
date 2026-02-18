/**
 * Unit tests for invitations query helpers.
 */

jest.mock('react', () => ({
  cache: (fn: unknown) => fn,
}))

function makeChain(resolveWith: unknown) {
  const chain: Record<string, jest.Mock> = {}
  const methods = ['from', 'select', 'eq', 'single', 'insert', 'delete', 'update', 'order', 'gt', 'gte', 'in']
  for (const m of methods) {
    chain[m] = jest.fn().mockReturnValue(chain)
  }
  chain['then'] = jest.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolve(resolveWith))
  )
  return chain
}

import { getInvitations, createInvitation, deleteInvitation } from '@/lib/queries/invitations'

describe('getInvitations', () => {
  it('returns invitations for workspace', async () => {
    const mockInvites = [
      { id: 'inv-1', email: 'test@test.com', role: 'viewer', expires_at: '2026-02-25', workspace_id: 'ws-1', invited_by: 'user-1', token: null, invite_count: 1, last_sent_at: null, reminder_sent_at: null, created_at: null }
    ]
    const mock = makeChain({ data: mockInvites, error: null })

    const result = await getInvitations(mock as any, 'ws-1')

    expect(mock.from).toHaveBeenCalledWith('invitations')
    expect(mock.eq).toHaveBeenCalledWith('workspace_id', 'ws-1')
    expect(result).toEqual(mockInvites)
  })

  it('returns empty array when no invitations', async () => {
    const mock = makeChain({ data: null, error: null })

    const result = await getInvitations(mock as any, 'ws-1')

    expect(result).toEqual([])
  })
})

describe('createInvitation', () => {
  it('inserts and returns new invitation', async () => {
    const newInvite = { id: 'inv-1', email: 'new@test.com', role: 'agent', workspace_id: 'ws-1', invited_by: 'user-1', expires_at: '2026-02-25', token: null, invite_count: 1, last_sent_at: null, reminder_sent_at: null, created_at: null }
    const mock = makeChain({ data: newInvite, error: null })

    const result = await createInvitation(mock as any, {
      workspace_id: 'ws-1',
      email: 'new@test.com',
      role: 'agent',
      invited_by: 'user-1',
    })

    expect(mock.from).toHaveBeenCalledWith('invitations')
    expect(result).toEqual(newInvite)
  })

  it('returns null when insert fails', async () => {
    const mock = makeChain({ data: null, error: { message: 'duplicate' } })

    const result = await createInvitation(mock as any, {
      workspace_id: 'ws-1',
      email: 'existing@test.com',
      invited_by: 'user-1',
    })

    expect(result).toBeNull()
  })
})

describe('deleteInvitation', () => {
  it('calls delete on invitations table with correct ID', async () => {
    const mock = makeChain({ error: null })

    await deleteInvitation(mock as any, 'inv-1')

    expect(mock.from).toHaveBeenCalledWith('invitations')
    expect(mock.delete).toHaveBeenCalled()
    expect(mock.eq).toHaveBeenCalledWith('id', 'inv-1')
  })
})
