import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Tables, Json } from '@/types/database.types'

export type EvalSet = Tables<'eval_sets'>
export type EvalCase = Tables<'eval_cases'>
export type EvalRun = Tables<'eval_runs'>

/**
 * Fetches all eval sets for a workspace, ordered by creation date (newest first).
 */
export const getEvalSets = cache(
  async (supabase: SupabaseClient, workspaceId: string): Promise<EvalSet[]> => {
    const { data, error } = await supabase
      .from('eval_sets')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    return data ?? []
  }
)

/**
 * Fetches all eval cases for a given eval set.
 */
export const getEvalCasesForSet = cache(
  async (supabase: SupabaseClient, evalSetId: string): Promise<EvalCase[]> => {
    const { data, error } = await supabase
      .from('eval_cases')
      .select('*')
      .eq('eval_set_id', evalSetId)

    if (error) throw new Error(error.message)
    return data ?? []
  }
)

/**
 * Fetches all eval runs for a given eval set, ordered by creation date (newest first).
 */
export const getEvalRunsForSet = cache(
  async (supabase: SupabaseClient, evalSetId: string): Promise<EvalRun[]> => {
    const { data, error } = await supabase
      .from('eval_runs')
      .select('*')
      .eq('eval_set_id', evalSetId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    return data ?? []
  }
)

export interface EvalRunInsert {
  eval_set_id: string
  recall_at_k: number
  answer_accuracy: number
  k_value: number
  details: Json
}

/**
 * Inserts a new eval run and returns the created record.
 */
export async function insertEvalRun(
  supabase: SupabaseClient,
  payload: EvalRunInsert
): Promise<EvalRun> {
  const { data, error } = await supabase
    .from('eval_runs')
    .insert(payload)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}
