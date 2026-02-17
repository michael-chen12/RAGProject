import { after } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { embedText } from '@/lib/openai/embeddings'
import { retrieveChunks } from '@/lib/rag/retrieval'
import { buildSystemPrompt } from '@/lib/rag/prompt'
import { streamChatResponse } from '@/lib/openai/chat'

// Sliding window: 20 requests per 60 seconds per user
// This must be initialized lazily (not at module level) to avoid crashing
// when UPSTASH env vars are not set in development/test environments.
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

export async function POST(request: Request) {
  // ── Step a: Auth ──────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Step b: Parse body ────────────────────────────────────────────────────
  let body: { workspaceId: string; message: string; threadId?: string; ephemeral?: boolean }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { workspaceId, message, threadId: requestedThreadId, ephemeral = false } = body
  if (!workspaceId || typeof workspaceId !== 'string') {
    return Response.json({ error: 'workspaceId is required' }, { status: 400 })
  }
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return Response.json({ error: 'message is required' }, { status: 400 })
  }

  // ── Step c: Workspace membership check ───────────────────────────────────
  // workspaceId is taken from the validated membership, NOT the request body.
  // This prevents workspace spoofing attacks.
  const { data: membership } = await supabase
    .from('memberships')
    .select('workspace_id, role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Use validated workspaceId from membership (not request body)
  const validatedWorkspaceId = membership.workspace_id

  // ── Step d: Rate limiting ─────────────────────────────────────────────────
  const rl = getRatelimit()
  if (rl) {
    const { success, reset } = await rl.limit(user.id)
    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000)
      return Response.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfter) },
        }
      )
    }
  }

  // ── Step e/f: Thread resolution ───────────────────────────────────────────
  // serviceClient is declared OUTSIDE the ephemeral gate — it's also needed
  // for retrieveChunks (the SECURITY DEFINER RPC requires service-role access).
  const serviceClient = createServiceClient()
  let threadId = ''  // empty string for ephemeral mode (not used downstream)

  if (!ephemeral) {
    if (requestedThreadId) {
      // Verify thread belongs to this user + workspace
      const { data: existingThread } = await serviceClient
        .from('chat_threads')
        .select('id')
        .eq('id', requestedThreadId)
        .eq('user_id', user.id)
        .eq('workspace_id', validatedWorkspaceId)
        .single()

      if (!existingThread) {
        return Response.json({ error: 'Thread not found or access denied' }, { status: 403 })
      }
      threadId = existingThread.id
    } else {
      // Create a new thread with a title derived from the first message
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

      if (threadError || !newThread) {
        return Response.json({ error: 'Failed to create thread' }, { status: 500 })
      }
      threadId = newThread.id
    }
  }

  // ── Steps g-i: RAG pipeline ───────────────────────────────────────────────
  const queryEmbedding = await embedText(message)
  const chunks = await retrieveChunks(serviceClient, validatedWorkspaceId, queryEmbedding, {
    k: 8,
    threshold: 0.5,
  })
  const { systemPrompt, citationMap } = buildSystemPrompt(chunks)

  // ── Step j: Stream from LLM ───────────────────────────────────────────────
  const textStream = await streamChatResponse(systemPrompt, message)
  const encoder = new TextEncoder()
  let fullText = ''

  // ── Step k: Build custom SSE ReadableStream ───────────────────────────────
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
        // After all tokens: emit the citations event
        controller.enqueue(
          encoder.encode(`data: [CITATIONS]${JSON.stringify(citationMap)}\n\n`)
        )
      } finally {
        controller.close()
      }
    },
  })

  // ── Step m: Persist messages after streaming (non-blocking) ──────────────
  // Ephemeral mode: skip persistence entirely — no thread, no messages stored.
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
        // Cast to Json — CitationEntry is a plain object that satisfies the Json shape at runtime
        citations: citationMap.length > 0
          ? (citationMap as unknown as import('@/types/database.types').Json)
          : null,
      },
    ])

    // Log low-confidence queries for KB gap analysis
    if (maxSimilarity < 0.6) {
      await serviceClient.from('missing_kb_entries').insert({
        workspace_id: validatedWorkspaceId,
        question: message,
        context: `Best similarity: ${(maxSimilarity * 100).toFixed(1)}%`,
      })
    }
  })

  // ── Step l: Return SSE response ───────────────────────────────────────────
  return new Response(sseStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      // Ephemeral mode has no thread — omit the header to avoid leaking an empty string
      ...(ephemeral ? {} : { 'X-Thread-Id': threadId }),
    },
  })
}
