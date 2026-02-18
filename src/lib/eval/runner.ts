import type { SupabaseClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { embedText } from '@/lib/openai/embeddings'
import { retrieveChunks } from '@/lib/rag/retrieval'
import { buildSystemPrompt } from '@/lib/rag/prompt'
import { streamChatResponse } from '@/lib/openai/chat'
import type { EvalCase } from '@/lib/queries/eval'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

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
  const expectedIds = Array.isArray(expected_source_ids) ? (expected_source_ids as string[]) : []

  // 1. Embed the question
  const embedding = await embedText(question)

  // 2. Retrieve top-k chunks
  const chunks = await retrieveChunks(supabase, workspaceId, embedding, { k: K, threshold: THRESHOLD })
  const retrievedChunkIds = chunks.map((c) => c.id)

  // 3. Recall hit check
  // If no expected sources are specified, recall is always false (nothing to match against)
  const recallHit = expectedIds.length > 0 && expectedIds.some((id) => retrievedChunkIds.includes(id))

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
  let llmScore = 0
  try {
    const judgeResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are an evaluator. Score how well the generated answer matches the expected answer on a scale from 0.0 to 1.0. ' +
            'Consider semantic similarity, completeness, and correctness. ' +
            'Respond with JSON only: {"score": 0.85}',
        },
        {
          role: 'user',
          content: `Expected answer: ${expected_answer}\n\nGenerated answer: ${generatedAnswer}`,
        },
      ],
    })
    const raw = judgeResponse.choices[0]?.message?.content ?? ''
    const parsed = JSON.parse(raw) as { score?: number }
    llmScore = typeof parsed.score === 'number' ? Math.min(1, Math.max(0, parsed.score)) : 0
  } catch {
    // Malformed JSON or API error — default to 0
    llmScore = 0
  }

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
