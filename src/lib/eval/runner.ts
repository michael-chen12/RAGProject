import type { SupabaseClient } from '@supabase/supabase-js'
import { embedText, streamChatResponse, chatCompletion } from '@/lib/gemini'
import { retrieveChunks } from '@/lib/rag/retrieval'
import { buildSystemPrompt } from '@/lib/rag/prompt'
import type { EvalCase } from '@/lib/queries/eval'

/** Number of chunks to retrieve for eval (higher than chat to avoid penalizing recall) */
const K = 5

/** Similarity threshold for eval (lower than chat's 0.5 to avoid missing relevant chunks) */
const THRESHOLD = 0.3

export interface EvalCaseResult {
  caseId: string
  question: string
  expectedAnswer: string
  generatedAnswer: string
  recallHit: boolean
  llmScore: number
  retrievedChunkIds: string[]
}

/**
 * Runs a single eval case:
 * 1. Embed the question
 * 2. Retrieve top-k chunks
 * 3. Check recall hit (expected source in retrieved chunks)
 * 4. Generate an answer via LLM
 * 5. Judge the answer with LLM-as-judge (score 0.0–1.0)
 */
export async function runEvalCase(
  supabase: SupabaseClient,
  workspaceId: string,
  evalCase: EvalCase
): Promise<EvalCaseResult> {
  const { id, question, expected_answer, expected_source_ids } = evalCase
  const expectedIds = Array.isArray(expected_source_ids)
    ? (expected_source_ids as string[])
    : []

  // 1. Embed the question
  const embedding = await embedText(question)

  // 2. Retrieve top-k chunks
  const chunks = await retrieveChunks(supabase, workspaceId, embedding, {
    k: K,
    threshold: THRESHOLD,
  })
  const retrievedChunkIds = chunks.map((c) => c.id)

  // 3. Recall hit check
  // If no expected sources are specified, recall is always false (nothing to match against)
  const recallHit =
    expectedIds.length > 0 &&
    expectedIds.some((id) => retrievedChunkIds.includes(id))

  // 4. Generate an answer
  const { systemPrompt } = buildSystemPrompt(chunks)
  const textStream = await streamChatResponse(systemPrompt, question)
  const reader = textStream.getReader()
  let generatedAnswer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    generatedAnswer += value
  }

  // 5. LLM-as-judge scoring
  const llmScore = await scoreWithLLM(expected_answer, generatedAnswer)

  return {
    caseId: id,
    question,
    expectedAnswer: expected_answer,
    generatedAnswer,
    recallHit,
    llmScore,
    retrievedChunkIds,
  }
}

async function scoreWithLLM(
  expectedAnswer: string,
  generatedAnswer: string
): Promise<number> {
  try {
    const systemPrompt =
      'You are an evaluator. Score how well the generated answer matches the expected answer on a scale from 0.0 to 1.0. ' +
      'Consider semantic similarity, completeness, and correctness. ' +
      'Respond with JSON only: {"score": 0.85}'

    const userMessage = `Expected answer: ${expectedAnswer}\n\nGenerated answer: ${generatedAnswer}`

    const raw = await chatCompletion(systemPrompt, userMessage)

    // Extract JSON from response (handle potential markdown code blocks)
    const jsonMatch = raw.match(/\{[^}]*"score"[^}]*\}/)
    if (!jsonMatch) {
      return 0
    }
    const parsed = JSON.parse(jsonMatch[0]) as { score?: number }
    return typeof parsed.score === 'number'
      ? Math.min(1, Math.max(0, parsed.score))
      : 0
  } catch {
    // Malformed JSON or API error — default to 0
    return 0
  }
}
