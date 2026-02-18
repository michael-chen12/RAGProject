import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Tables, TablesUpdate } from '@/types/database.types'

type Profile = Tables<'profiles'>

/**
 * Fetches a user profile by ID.
 * Cached per-request via React cache() to avoid duplicate DB calls.
 */
export const getProfile = cache(
  async (supabase: SupabaseClient, userId: string): Promise<Profile | null> => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    return data ?? null
  }
)

/**
 * Updates a user profile.
 * Returns the updated profile or null on error.
 */
export async function updateProfile(
  supabase: SupabaseClient,
  userId: string,
  updates: TablesUpdate<'profiles'>
): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()

  return data ?? null
}

/**
 * Gets profiles for multiple user IDs (for member lists).
 * Cached per-request.
 */
export const getProfilesByIds = cache(
  async (supabase: SupabaseClient, userIds: string[]): Promise<Profile[]> => {
    if (userIds.length === 0) return []

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .in('id', userIds)

    return data ?? []
  }
)
