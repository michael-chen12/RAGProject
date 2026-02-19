import { NextRequest, after } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { embedText } from '@/lib/openai/embeddings'
import { retrieveChunks } from '@/lib/rag/retrieval'
import { buildSystemPrompt } from '@/lib/rag/prompt'
import { streamChatResponse } from '@/lib/openai/chat'
import { withStreamingErrorHandler } from '@/lib/api/with-error-handler'
import { Errors } from '@/lib/api/errors'
import { setLogContext } from '@/lib/api/logger'

// Sliding window: 20 requests per 60 seconds per user
// Initialized lazily to avoid crashing when UPSTASH env vars are not set.
let ratelimit: Ratelimit | null = null

function getRatelimit(): Ratelimit | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  if (!ratelimit) {
    ratelimit = new Ratelimit({
      redis: new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      }),
      limiter: Ratelimit.slidingWindow(20, '60s'),
      prefix: 'rag:chat',
    })
  }
  return ratelimit
}

async function handlePost(request: NextRequest) {
  const requestId = request.headers.get('x-internal-request-id') ?? ''

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw Errors.unauthorized()
  setLogContext(requestId, { userId: user.id })

  let body: { workspaceId: string; message: string; threadId?: string; ephemeral?: boolean }
  try {
    body = await request.json()
  } catch {
    throw Errors.invalidJson()
  }

  const { workspaceId, message, threadId: requestedThreadId, ephemeral = false } = body
  if (!workspaceId || typeof workspaceId !== 'string') {
    throw Errors.validation('workspaceId is required')
  }
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    throw Errors.validation('message is required')
  }

  // workspaceId is taken from the validated membership, NOT the request body.
  const { data: membership } = await supabase
    .from('memberships')
    .select('workspace_id, role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()

  if (!membership) throw Errors.forbidden()

  const validatedWorkspaceId = membership.workspace_id
  setLogContext(requestId, { workspaceId: validatedWorkspaceId })

  // Rate limiting
  const rl = getRatelimit()
  if (rl) {
    const { success, reset } = await rl.limit(user.id)
    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000)
      throw Errors.rateLimited(retryAfter)
    }
  }

  const serviceClient = createServiceClient()
  let threadId = ''

  if (!ephemeral) {
    if (requestedThreadId) {
      const { data: existingThread } = await serviceClient
        .from('chat_threads')
        .select('id')
        .eq('id', requestedThreadId)
        .eq('user_id', user.id)
        .eq('workspace_id', validatedWorkspaceId)
        .single()

      if (!existingThread) throw Errors.forbidden('Thread not found or access denied')
      threadId = existingThread.id
    } else {
      const title = message.slice(0, 50)
      const { data: newThread, error: threadError } = await serviceClient
        .from('chat_threads')
        .insert({
          workspace_id: validatedWorkspaceId,
          user_id: user.id,
          title,
        })
        .select('id')
        .single()

      if (threadError || !newThread) throw Errors.internal('Failed to create thread')
      threadId = newThread.id
    }
  }

  const queryEmbedding = await embedText(message)
  const chunks = await retrieveChunks(serviceClient, validatedWorkspaceId, queryEmbedding, {
    k: 8,
    threshold: 0.5,
  })
  const { systemPrompt, citationMap } = buildSystemPrompt(chunks)

  const textStream = await streamChatResponse(systemPrompt, message)
  const encoder = new TextEncoder()
  let fullText = ''

  const sseStream = new ReadableStream({
    async start(controller) {
      try {
        const reader = textStream.getReader()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          fullText += value
          controller.enqueue(encoder.encode(`data: ${value}\n\n`))
        }
        controller.enqueue(
          encoder.encode(`data: [CITATIONS]${JSON.stringify(citationMap)}\n\n`)
        )
      } finally {
        controller.close()
      }
    },
  })

  // Persist messages after streaming (non-blocking)
  if (!ephemeral) after(async () => {
    const maxSimilarity = chunks.length > 0
      ? Math.max(...chunks.map((c) => c.similarity))
      : 0

    await serviceClient.from('chat_messages').insert([
      { thread_id: threadId, role: 'user' as const, content: message },
      {
        thread_id: threadId,
        role: 'assistant' as const,
        content: fullText,
        citations: citationMap.length > 0
          ? (citationMap as unknown as import('@/types/database.types').Json)
          : null,
      },
    ])

    if (maxSimilarity < 0.6) {
      await serviceClient.from('missing_kb_entries').insert({
        workspace_id: validatedWorkspaceId,
        question: message,
        context: `Best similarity: ${(maxSimilarity * 100).toFixed(1)}%`,
      })
    }
  })

  return new Response(sseStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      ...(ephemeral ? {} : { 'X-Thread-Id': threadId }),
    },
  })
}

export const POST = withStreamingErrorHandler(handlePost)
