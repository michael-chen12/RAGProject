/**
 * Displays workspace feedback ratio (thumbs up / thumbs down).
 * Server component — no client-side state needed.
 */
interface Props {
  data: { up: number; down: number; total: number }
}

export default function FeedbackSummary({ data }: Props) {
  const { up, down, total } = data
  const upPct = total > 0 ? Math.round((up / total) * 100) : 0

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-neutral-700 mb-4">
        User Feedback
      </h2>
      {total === 0 ? (
        <p className="text-sm text-neutral-400">No feedback recorded yet.</p>
      ) : (
        <div className="space-y-3">
          {/* Progress bar */}
          <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${upPct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-neutral-500">
            <span>👍 {up} positive ({upPct}%)</span>
            <span>👎 {down} negative ({100 - upPct}%)</span>
          </div>
          <p className="text-xs text-neutral-400">{total} total ratings</p>
        </div>
      )}
    </div>
  )
}
