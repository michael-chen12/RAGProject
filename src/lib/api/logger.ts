import pino from 'pino'

// Singleton logger — created once at module load.
// In production: outputs newline-delimited JSON (for Vercel log drains).
// In development: pretty-prints with colors and human-readable timestamps.
const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  // Redact sensitive fields wherever they appear in log objects.
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token'],
    censor: '[REDACTED]',
  },
  transport:
    process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
})

export default logger

// ----------------------------------------------------------------------------
// Per-request child logger
// ----------------------------------------------------------------------------

export type LogContext = {
  requestId: string
  method: string
  pathname: string
  userId?: string
  workspaceId?: string
}

/**
 * Creates a child logger bound to a specific request.
 * Child loggers inherit the parent's config but stamp every log line
 * with the provided context fields automatically.
 */
export function createRequestLogger(ctx: LogContext) {
  return logger.child(ctx)
}

// ----------------------------------------------------------------------------
// Mutable log-context store (set by handlers after auth)
// ----------------------------------------------------------------------------

// Map from requestId → extra context fields added by the route handler
// after authentication resolves userId / workspaceId.
const contextStore = new Map<string, Partial<Pick<LogContext, 'userId' | 'workspaceId'>>>()

export function setLogContext(
  requestId: string,
  fields: Partial<Pick<LogContext, 'userId' | 'workspaceId'>>
) {
  contextStore.set(requestId, { ...contextStore.get(requestId), ...fields })
}

export function getLogContext(requestId: string) {
  return contextStore.get(requestId) ?? {}
}

export function clearLogContext(requestId: string) {
  contextStore.delete(requestId)
}
