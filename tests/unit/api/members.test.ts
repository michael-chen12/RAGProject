/**
 * Unit tests for POST /api/workspaces/[id]/members (invite endpoint).
 * Verifies: auth, admin-only enforcement, email validation, role validation.
 */

// ── Mocks must be defined before imports ──────────────────────────────────────
const mockGetUser = jest.fn()
const mockFrom = jest.fn()
const mockAdminInvite = jest.fn()

function makeChain(resolveWith: unknown) {
  const chain: Record<string, jest.Mock> = {}
  const methods = ['select', 'eq', 'single', 'insert', 'gte', 'order', 'in', 'gt', 'delete', 'update']
  for (const m of methods) {
    chain[m] = jest.fn().mockReturnValue(chain)
  }
  chain['then'] = jest.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolve(resolveWith))
  )
  return chain
}

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockImplementation(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
  createServiceClient: jest.fn().mockReturnValue({
    auth: { admin: { inviteUserByEmail: mockAdminInvite } },
    from: jest.fn().mockReturnValue(makeChain({ data: null, error: null, count: 0 })),
  }),
}))

// Must mock profiles query too (imported by GET handler)
jest.mock('@/lib/queries/profiles', () => ({
  getProfilesByIds: jest.fn().mockResolvedValue([]),
}))

describe('POST /api/workspaces/[id]/members', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAdminInvite.mockResolvedValue({ data: {}, error: null })
  })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const { POST } = await import('@/app/api/workspaces/[id]/members/route')
    const req = new Request('http://localhost/api/workspaces/ws-1/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new@test.com', role: 'viewer' }),
    })

    const res = await POST(req as any, { params: Promise.resolve({ id: 'ws-1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 403 when user is not admin', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    // membership query returns viewer role
    mockFrom.mockReturnValue(makeChain({ data: { role: 'viewer' }, error: null }))

    const { POST } = await import('@/app/api/workspaces/[id]/members/route')
    const req = new Request('http://localhost/api/workspaces/ws-1/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new@test.com', role: 'viewer' }),
    })

    const res = await POST(req as any, { params: Promise.resolve({ id: 'ws-1' }) })
    expect(res.status).toBe(403)
  })

  it('returns 400 when email is invalid', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockFrom.mockReturnValue(makeChain({ data: { role: 'admin' }, error: null }))

    const { POST } = await import('@/app/api/workspaces/[id]/members/route')
    const req = new Request('http://localhost/api/workspaces/ws-1/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', role: 'viewer' }),
    })

    const res = await POST(req as any, { params: Promise.resolve({ id: 'ws-1' }) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/email/i)
  })

  it('returns 400 when role is invalid', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockFrom.mockReturnValue(makeChain({ data: { role: 'admin' }, error: null }))

    const { POST } = await import('@/app/api/workspaces/[id]/members/route')
    const req = new Request('http://localhost/api/workspaces/ws-1/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'valid@test.com', role: 'superuser' }),
    })

    const res = await POST(req as any, { params: Promise.resolve({ id: 'ws-1' }) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/role/i)
  })
})
