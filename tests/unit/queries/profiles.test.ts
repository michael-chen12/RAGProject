/**
 * Unit tests for profiles query helpers.
 */

jest.mock('react', () => ({
  cache: (fn: unknown) => fn,
}))

function makeChain(resolveWith: unknown) {
  const chain: Record<string, jest.Mock> = {}
  const methods = ['from', 'select', 'eq', 'single', 'update', 'in']
  for (const m of methods) {
    chain[m] = jest.fn().mockReturnValue(chain)
  }
  chain['then'] = jest.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolve(resolveWith))
  )
  return chain
}

import { getProfile, updateProfile, getProfilesByIds } from '@/lib/queries/profiles'

describe('getProfile', () => {
  it('returns profile for given user ID', async () => {
    const mockProfile = { id: 'user-1', email: 'test@test.com', first_name: 'John', last_name: 'Doe', created_at: null }
    const mock = makeChain({ data: mockProfile, error: null })

    const result = await getProfile(mock as any, 'user-1')

    expect(mock.from).toHaveBeenCalledWith('profiles')
    expect(mock.eq).toHaveBeenCalledWith('id', 'user-1')
    expect(result).toEqual(mockProfile)
  })

  it('returns null when profile not found', async () => {
    const mock = makeChain({ data: null, error: null })

    const result = await getProfile(mock as any, 'user-1')

    expect(result).toBeNull()
  })
})

describe('updateProfile', () => {
  it('updates profile with given data and returns updated profile', async () => {
    const updated = { id: 'user-1', email: 'test@test.com', first_name: 'Jane', last_name: 'Smith', created_at: null }
    const mock = makeChain({ data: updated, error: null })

    const result = await updateProfile(mock as any, 'user-1', { first_name: 'Jane' })

    expect(mock.from).toHaveBeenCalledWith('profiles')
    expect(result).toEqual(updated)
  })

  it('returns null when update fails', async () => {
    const mock = makeChain({ data: null, error: { message: 'error' } })

    const result = await updateProfile(mock as any, 'user-1', { first_name: 'Jane' })

    expect(result).toBeNull()
  })
})

describe('getProfilesByIds', () => {
  it('returns empty array when no IDs provided', async () => {
    const mock = makeChain({ data: [], error: null })

    const result = await getProfilesByIds(mock as any, [])

    expect(mock.from).not.toHaveBeenCalled()
    expect(result).toEqual([])
  })

  it('fetches profiles for given IDs', async () => {
    const profiles = [
      { id: 'user-1', email: 'a@test.com', first_name: 'A', last_name: 'B', created_at: null },
      { id: 'user-2', email: 'b@test.com', first_name: 'C', last_name: 'D', created_at: null },
    ]
    const mock = makeChain({ data: profiles, error: null })

    const result = await getProfilesByIds(mock as any, ['user-1', 'user-2'])

    expect(mock.from).toHaveBeenCalledWith('profiles')
    expect(mock.in).toHaveBeenCalledWith('id', ['user-1', 'user-2'])
    expect(result).toEqual(profiles)
  })
})
