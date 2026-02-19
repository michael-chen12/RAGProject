// ---------------------------------------------------------------------------
// Standardized API error codes
// ---------------------------------------------------------------------------

export type ErrorCode =
  | 'AUTH_REQUIRED'    // 401 — no valid session
  | 'FORBIDDEN'        // 403 — authenticated but not allowed
  | 'VALIDATION_ERROR' // 400 — invalid input / missing fields
  | 'INVALID_JSON'     // 400 — malformed JSON body
  | 'NOT_FOUND'        // 404 — resource doesn't exist
  | 'CONFLICT'         // 409 — duplicate resource
  | 'RATE_LIMITED'     // 429 — too many requests
  | 'INTERNAL_ERROR'   // 500 — unexpected server failure

// Map each code to its HTTP status so callers never hard-code numbers.
const STATUS_BY_CODE: Record<ErrorCode, number> = {
  AUTH_REQUIRED:    401,
  FORBIDDEN:        403,
  VALIDATION_ERROR: 400,
  INVALID_JSON:     400,
  NOT_FOUND:        404,
  CONFLICT:         409,
  RATE_LIMITED:     429,
  INTERNAL_ERROR:   500,
}

// ---------------------------------------------------------------------------
// ApiError class
// ---------------------------------------------------------------------------

/**
 * Structured error that can be thrown inside any route handler.
 * `withErrorHandler` catches these and converts them to JSON responses
 * WITHOUT leaking stack traces to the client.
 */
export class ApiError extends Error {
  readonly code: ErrorCode
  readonly status: number
  /** Extra HTTP headers to include in the response (e.g. Retry-After). */
  readonly headers: Record<string, string>

  constructor(
    code: ErrorCode,
    message: string,
    headers: Record<string, string> = {}
  ) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = STATUS_BY_CODE[code]
    this.headers = headers
  }

  /**
   * Converts this error to a NextResponse-compatible plain object.
   * The stack trace is intentionally excluded.
   */
  toResponse(): { body: { error: string; code: ErrorCode }; status: number; headers: Record<string, string> } {
    return {
      body: { error: this.message, code: this.code },
      status: this.status,
      headers: this.headers,
    }
  }
}

// ---------------------------------------------------------------------------
// Errors factory — convenience helpers used throughout the codebase
// ---------------------------------------------------------------------------

export const Errors = {
  unauthorized(message = 'Authentication required') {
    return new ApiError('AUTH_REQUIRED', message)
  },

  forbidden(message = 'Permission denied') {
    return new ApiError('FORBIDDEN', message)
  },

  validation(message: string) {
    return new ApiError('VALIDATION_ERROR', message)
  },

  invalidJson(message = 'Invalid JSON body') {
    return new ApiError('INVALID_JSON', message)
  },

  notFound(message = 'Resource not found') {
    return new ApiError('NOT_FOUND', message)
  },

  conflict(message: string) {
    return new ApiError('CONFLICT', message)
  },

  rateLimited(retryAfterSeconds?: number) {
    const headers: Record<string, string> = {}
    if (retryAfterSeconds !== undefined) {
      headers['Retry-After'] = String(retryAfterSeconds)
    }
    return new ApiError('RATE_LIMITED', 'Too many requests', headers)
  },

  internal(message = 'Internal server error') {
    return new ApiError('INTERNAL_ERROR', message)
  },
} as const
