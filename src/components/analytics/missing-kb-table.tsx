/**
 * Table of recent low-confidence queries — questions the KB couldn't answer well.
 * Server component. Used by the analytics dashboard to surface KB gaps.
 */
import type { Tables } from '@/types/database.types'

type MissingKbEntry = Tables<'missing_kb_entries'>

interface Props {
  entries: MissingKbEntry[]
}

export default function MissingKbTable({ entries }: Props) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-neutral-700 mb-4">
        Unanswered / Low-Confidence Queries
      </h2>
      {entries.length === 0 ? (
        <p className="text-sm text-neutral-400">
          No low-confidence queries yet. Great KB coverage!
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100">
                <th className="text-left py-2 pr-4 font-medium text-neutral-500">
                  Question
                </th>
                <th className="text-left py-2 pr-4 font-medium text-neutral-500">
                  Context
                </th>
                <th className="text-left py-2 font-medium text-neutral-500">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-neutral-50">
                  <td className="py-2 pr-4 text-neutral-800 max-w-xs truncate">
                    {entry.question}
                  </td>
                  <td className="py-2 pr-4 text-neutral-500">
                    {entry.context ?? '—'}
                  </td>
                  <td className="py-2 text-neutral-400 whitespace-nowrap">
                    {new Date(entry.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
