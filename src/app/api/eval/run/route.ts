import { NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getEvalCasesForSet, insertEvalRun } from '@/lib/queries/eval'
import { runEvalCase, type EvalCaseResult } from '@/lib/eval/runner'
import type { Json } from '@/types/database.types'
import { withStreamingErrorHandler } from '@/lib/api/with-error-handler'
import { Errors } from '@/lib/api/errors'
import { setLogContext } from '@/lib/api/logger'

export const maxDuration = 60 // Vercel max: 60s on hobby, 300s on pro

async function handlePost(request: NextRequest): Promise<Response> {
  const requestId = request.headers.get('x-internal-request-id') ?? ''

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw Errors.unauthorized()
  setLogContext(requestId, { userId: user.id })

  let body: { evalSetId?: string; workspaceId?: string }
  try {
    body = await request.json()
  } catch {
    throw Errors.invalidJson()
  }

  const { evalSetId, workspaceId } = body
  if (!evalSetId || !workspaceId) {
    throw Errors.validation('evalSetId and workspaceId are required')
  }

  const { data: membership } = await supabase
    .from('memberships')
    .select('role, workspace_id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()

  if (!membership) throw Errors.forbidden()
  if (membership.role !== 'admin') throw Errors.forbidden('Admin role required')

  setLogContext(requestId, { workspaceId: membership.workspace_id })

  const serviceClient = createServiceClient()
  const cases = await getEvalCasesForSet(serviceClient, evalSetId)

  if (cases.length === 0) throw Errors.notFound('No eval cases found for this set')

  // Stream NDJSON progress
  const encoder = new TextEncoder()
  const results: EvalCaseResult[] = []

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for (let i = 0; i < cases.length; i++) {
          const evalCase = cases[i]

          const progressEvent = JSON.stringify({
            type: 'progress',
            current: i,
            total: cases.length,
          })
          controller.enqueue(encoder.encode(progressEvent + '\n'))

          const result = await runEvalCase(serviceClient, workspaceId, evalCase)
          results.push(result)
        }

        const recallAtK = results.filter((r) => r.recallHit).length / results.length
        const answerAccuracy = results.reduce((sum, r) => sum + r.llmScore, 0) / results.length

        const evalRun = await insertEvalRun(serviceClient, {
          eval_set_id: evalSetId,
          recall_at_k: recallAtK,
          answer_accuracy: answerAccuracy,
          k_value: 5,
          details: results as unknown as Json,
        })

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

export const POST = withStreamingErrorHandler(handlePost)
