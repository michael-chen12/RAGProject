import { NextRequest, NextResponse } from 'next/server'
import { createRequestLogger, getLogContext, clearLogContext } from './logger'
import { ApiError, Errors } from './errors'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Handler = (req: NextRequest, ctx: RouteContext) => Promise<NextResponse | Response>

// Next.js App Router passes dynamic segment params as a second argument.
// In Next.js 15, params is a Promise<Record<string, string>>.
// We use a union so the wrapper accepts both dynamic and static routes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteContext = { params?: any }

// ---------------------------------------------------------------------------
// Shared helper: attach X-Request-Id and log the outcome
// ---------------------------------------------------------------------------

function buildResponseWithId(response: Response, requestId: string): Response {
  const headers = new Headers(response.headers)
  headers.set('X-Request-Id', requestId)
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

// ---------------------------------------------------------------------------
// withErrorHandler — for standard (non-streaming) routes
// ---------------------------------------------------------------------------

/**
 * Wraps a Next.js App Router handler with:
 * - UUID request ID stamped on every response as `X-Request-Id`
 * - Structured pino logging (request start + completion with durationMs)
 * - ApiError → typed JSON response (no stack trace exposed)
 * - Unexpected errors → generic 500 (stack logged server-side only)
 */
export function withErrorHandler(handler: Handler) {
  return async function wrappedHandler(
    req: NextRequest,
    ctx: RouteContext = {}
  ): Promise<Response> {
    const requestId = crypto.randomUUID()
    const { method, nextUrl } = req
    const pathname = nextUrl.pathname

    const log = createRequestLogger({ requestId, method, pathname })
    const startMs = Date.now()

    log.info('request started')

    // Inject requestId into request headers so handlers can call setLogContext.
    // We create a new Request object with the extra header rather than mutating.
    const enrichedReq = new NextRequest(req, {
      headers: { ...Object.fromEntries(req.headers), 'x-internal-request-id': requestId },
    })

    try {
      const response = await handler(enrichedReq, ctx)

      // Enrich log with any userId/workspaceId set by the handler after auth
      const extra = getLogContext(requestId)
      const durationMs = Date.now() - startMs

      log.info({ ...extra, statusCode: response.status, durationMs }, 'request completed')

      return buildResponseWithId(response, requestId)
    } catch (err) {
      const durationMs = Date.now() - startMs

      if (err instanceof ApiError) {
        const { body, status, headers } = err.toResponse()
        const extra = getLogContext(requestId)

        log.warn({ ...extra, statusCode: status, durationMs, code: err.code }, err.message)

        const responseHeaders = new Headers(headers)
        responseHeaders.set('Content-Type', 'application/json')
        responseHeaders.set('X-Request-Id', requestId)

        return new Response(JSON.stringify(body), { status, headers: responseHeaders })
      }

      // Unexpected errors — log full stack server-side, return generic 500
      log.error({ err, durationMs }, 'unhandled error')

      const { body, status } = Errors.internal().toResponse()
      return new Response(JSON.stringify(body), {
        status,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
        },
      })
    } finally {
      clearLogContext(requestId)
    }
  }
}

// ---------------------------------------------------------------------------
// withStreamingErrorHandler — for SSE / NDJSON streaming routes
// ---------------------------------------------------------------------------

/**
 * Same as withErrorHandler but handles ReadableStream responses.
 * - Errors thrown BEFORE the stream starts are caught and returned as JSON.
 * - Errors occurring INSIDE the stream are logged but cannot be sent to the
 *   client (the HTTP status is already committed). The stream is closed.
 */
export function withStreamingErrorHandler(handler: Handler) {
  return async function wrappedStreamingHandler(
    req: NextRequest,
    ctx: RouteContext = {}
  ): Promise<Response> {
    const requestId = crypto.randomUUID()
    const { method, nextUrl } = req
    const pathname = nextUrl.pathname

    const log = createRequestLogger({ requestId, method, pathname })
    const startMs = Date.now()

    log.info('streaming request started')

    const enrichedReq = new NextRequest(req, {
      headers: { ...Object.fromEntries(req.headers), 'x-internal-request-id': requestId },
    })

    try {
      const response = await handler(enrichedReq, ctx)

      // If the handler returned a streaming Response, wrap its body to log
      // when the stream finishes.
      if (response.body) {
        const originalBody = response.body
        const wrappedBody = new ReadableStream({
          async start(controller) {
            const reader = originalBody.getReader()
            try {
              while (true) {
                const { done, value } = await reader.read()
                if (done) break
                controller.enqueue(value)
              }
              controller.close()

              const extra = getLogContext(requestId)
              log.info(
                { ...extra, statusCode: response.status, durationMs: Date.now() - startMs },
                'stream completed'
              )
            } catch (streamErr) {
              log.error({ err: streamErr, durationMs: Date.now() - startMs }, 'stream error')
              controller.error(streamErr)
            } finally {
              clearLogContext(requestId)
            }
          },
        })

        const headers = new Headers(response.headers)
        headers.set('X-Request-Id', requestId)

        return new Response(wrappedBody, {
          status: response.status,
          headers,
        })
      }

      // Non-streaming response (edge case, e.g. early return)
      return buildResponseWithId(response, requestId)
    } catch (err) {
      const durationMs = Date.now() - startMs
      clearLogContext(requestId)

      if (err instanceof ApiError) {
        const { body, status, headers } = err.toResponse()
        const extra = getLogContext(requestId)

        log.warn({ ...extra, statusCode: status, durationMs, code: err.code }, err.message)

        const responseHeaders = new Headers(headers)
        responseHeaders.set('Content-Type', 'application/json')
        responseHeaders.set('X-Request-Id', requestId)

        return new Response(JSON.stringify(body), { status, headers: responseHeaders })
      }

      log.error({ err, durationMs }, 'unhandled streaming error')

      const { body, status } = Errors.internal().toResponse()
      return new Response(JSON.stringify(body), {
        status,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
        },
      })
    }
  }
}
