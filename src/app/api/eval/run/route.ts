import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getEvalCasesForSet, insertEvalRun } from '@/lib/queries/eval'
import { runEvalCase, type EvalCaseResult } from '@/lib/eval/runner'
import type { Json } from '@/types/database.types'

export const maxDuration = 60 // Vercel max: 60s on hobby, 300s on pro

export async function POST(request: Request): Promise<Response> {
  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 2. Parse body ─────────────────────────────────────────────────────────
  let body: { evalSetId?: string; workspaceId?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { evalSetId, workspaceId } = body
  if (!evalSetId || !workspaceId) {
    return Response.json({ error: 'evalSetId and workspaceId are required' }, { status: 400 })
  }

  // ── 3. RBAC: admin only ────────────────────────────────────────────────────
  const { data: membership } = await supabase
    .from('memberships')
    .select('role, workspace_id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (membership.role !== 'admin') {
    return Response.json({ error: 'Admin role required' }, { status: 403 })
  }

  // ── 4. Fetch eval cases ───────────────────────────────────────────────────
  const serviceClient = createServiceClient()
  const cases = await getEvalCasesForSet(serviceClient, evalSetId)

  if (cases.length === 0) {
    return Response.json({ error: 'No eval cases found for this set' }, { status: 404 })
  }

  // ── 5. Stream NDJSON progress ─────────────────────────────────────────────
  const encoder = new TextEncoder()
  const results: EvalCaseResult[] = []

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for (let i = 0; i < cases.length; i++) {
          const evalCase = cases[i]

          // Send progress event BEFORE running this case
          const progressEvent = JSON.stringify({
            type: 'progress',
            current: i,
            total: cases.length,
          })
          controller.enqueue(encoder.encode(progressEvent + '\n'))

          // Run case sequentially (respect OpenAI rate limits)
          const result = await runEvalCase(serviceClient, workspaceId, evalCase)
          results.push(result)
        }

        // ── 6. Compute aggregated metrics ─────────────────────────────────
        const recallAtK = results.filter((r) => r.recallHit).length / results.length
        const answerAccuracy = results.reduce((sum, r) => sum + r.llmScore, 0) / results.length

        // ── 7. Persist eval run ────────────────────────────────────────────
        const evalRun = await insertEvalRun(serviceClient, {
          eval_set_id: evalSetId,
          recall_at_k: recallAtK,
          answer_accuracy: answerAccuracy,
          k_value: 5,
          details: results as unknown as Json,
        })

        // ── 8. Send completion event ──────────────────────────────────────
        const completeEvent = JSON.stringify({
          type: 'complete',
          runId: evalRun.id,
          recall_at_k: recallAtK,
          answer_accuracy: answerAccuracy,
          total: cases.length,
        })
        controller.enqueue(encoder.encode(completeEvent + '\n'))
      } catch (err) {
        const errorEvent = JSON.stringify({
          type: 'error',
          message: err instanceof Error ? err.message : 'Unknown error',
        })
        controller.enqueue(encoder.encode(errorEvent + '\n'))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
    },
  })
}
