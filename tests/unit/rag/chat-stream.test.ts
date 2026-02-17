/**
 * Unit tests for the useChatStream hook.
 * Mocks fetch() to return a ReadableStream with synthetic SSE events.
 * Verifies: token accumulation, citation extraction, error handling, thread ID capture.
 *
 * Note: These tests run in jsdom (via @testing-library/react) to simulate
 * the browser environment where the hook will run.
 * @jest-environment jsdom
 */

// JSDOM doesn't expose Node.js globals — polyfill them for this test file
import { TextEncoder, TextDecoder } from 'util'
import { ReadableStream } from 'stream/web'

Object.assign(global, { TextEncoder, TextDecoder, ReadableStream })

import { renderHook, act } from '@testing-library/react'
import { useChatStream } from '@/hooks/use-chat-stream'

/**
 * Creates a mock ReadableStream that emits SSE-formatted events.
 * Each string in `events` is emitted as a `data: ...\n\n` SSE event.
 */
function makeSseStream(events: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${event}\n\n`))
      }
      controller.close()
    },
  })
}

describe('useChatStream', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('accumulates streamed tokens into the assistant message', async () => {
    const stream = makeSseStream(['Hello', ', ', 'world', '!'])

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: jest.fn().mockReturnValue('thread-abc') },
      body: stream,
    } as unknown as Response)

    const { result } = renderHook(() => useChatStream())

    await act(async () => {
      await result.current.sendMessage('ws-1', 'Hi there')
    })

    // Should have user + assistant messages
    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[0]).toMatchObject({ role: 'user', content: 'Hi there' })
    expect(result.current.messages[1]).toMatchObject({
      role: 'assistant',
      content: 'Hello, world!',
    })
  })

  it('extracts citations from [CITATIONS] SSE event', async () => {
    const citationMap = [
      {
        index: 1,
        chunkId: 'c1',
        documentId: 'd1',
        filename: 'guide.pdf',
        snippet: 'Some relevant text',
        similarity: 0.88,
      },
    ]

    const stream = makeSseStream([
      'The answer is 42 [1].',
      `[CITATIONS]${JSON.stringify(citationMap)}`,
    ])

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: jest.fn().mockReturnValue('thread-xyz') },
      body: stream,
    } as unknown as Response)

    const { result } = renderHook(() => useChatStream())

    await act(async () => {
      await result.current.sendMessage('ws-1', 'What is the answer?')
    })

    const assistantMsg = result.current.messages[1]
    expect(assistantMsg.citations).toHaveLength(1)
    expect(assistantMsg.citations[0]).toMatchObject({
      index: 1,
      filename: 'guide.pdf',
      similarity: 0.88,
    })
    // Citations event should NOT appear in message content
    expect(assistantMsg.content).not.toContain('[CITATIONS]')
  })

  it('captures X-Thread-Id from response header', async () => {
    const stream = makeSseStream(['Response text'])

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: jest.fn().mockReturnValue('thread-new-123') },
      body: stream,
    } as unknown as Response)

    const { result } = renderHook(() => useChatStream())

    expect(result.current.threadId).toBeNull()

    await act(async () => {
      await result.current.sendMessage('ws-1', 'First message')
    })

    expect(result.current.threadId).toBe('thread-new-123')
  })

  it('sets error state and removes empty assistant placeholder on 401 response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: { get: jest.fn().mockReturnValue(null) },
      json: jest.fn().mockResolvedValue({ error: 'Unauthorized' }),
    } as unknown as Response)

    const { result } = renderHook(() => useChatStream())

    await act(async () => {
      await result.current.sendMessage('ws-1', 'Test')
    })

    expect(result.current.error).toBeTruthy()
    // Only the user message should remain (empty assistant placeholder removed)
    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0].role).toBe('user')
  })

  it('shows rate limit message on 429 response with Retry-After header', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: {
        get: jest.fn().mockImplementation((name: string) =>
          name === 'Retry-After' ? '30' : null
        ),
      },
      json: jest.fn().mockResolvedValue({ error: 'Too many requests' }),
    } as unknown as Response)

    const { result } = renderHook(() => useChatStream())

    await act(async () => {
      await result.current.sendMessage('ws-1', 'Rapid fire')
    })

    expect(result.current.error).toContain('Rate limited')
    expect(result.current.error).toContain('30')
  })

  it('does not send a new message while already streaming', async () => {
    // Never-ending stream to simulate ongoing streaming
    const neverEndingStream = new ReadableStream({ start() {} })

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: jest.fn().mockReturnValue(null) },
      body: neverEndingStream,
    } as unknown as Response)

    const { result } = renderHook(() => useChatStream())

    // Start streaming (don't await — intentionally leave it pending)
    act(() => {
      result.current.sendMessage('ws-1', 'First')
    })

    // Try sending a second message immediately
    await act(async () => {
      await result.current.sendMessage('ws-1', 'Second')
    })

    // fetch should only have been called once
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('reset() clears messages and threadId', async () => {
    const stream = makeSseStream(['Some text'])

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: jest.fn().mockReturnValue('thread-abc') },
      body: stream,
    } as unknown as Response)

    const { result } = renderHook(() => useChatStream())

    await act(async () => {
      await result.current.sendMessage('ws-1', 'Hello')
    })

    expect(result.current.messages.length).toBeGreaterThan(0)

    act(() => {
      result.current.reset()
    })

    expect(result.current.messages).toHaveLength(0)
    expect(result.current.threadId).toBeNull()
    expect(result.current.error).toBeNull()
  })
})
