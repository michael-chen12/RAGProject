import type { EvalCaseResult } from '@/lib/eval/runner'

interface Props {
  results: EvalCaseResult[]
}

export function EvalResultsTable({ results }: Props) {
  if (results.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-neutral-400">
        No results in this run.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-neutral-200">
            <th className="py-2 px-3 text-left text-xs font-medium text-neutral-500 w-1/4">
              Question
            </th>
            <th className="py-2 px-3 text-left text-xs font-medium text-neutral-500 w-16">
              Recall
            </th>
            <th className="py-2 px-3 text-left text-xs font-medium text-neutral-500 w-1/4">
              Expected
            </th>
            <th className="py-2 px-3 text-left text-xs font-medium text-neutral-500 w-1/4">
              Generated
            </th>
            <th className="py-2 px-3 text-left text-xs font-medium text-neutral-500 w-16">
              Score
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {results.map((r) => (
            <tr key={r.caseId} className={r.recallHit ? 'bg-green-50' : 'bg-red-50'}>
              <td className="py-2 px-3 text-neutral-800">{r.question}</td>
              <td className="py-2 px-3">
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                    r.recallHit ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}
                >
                  {r.recallHit ? 'Hit' : 'Miss'}
                </span>
              </td>
              <td className="py-2 px-3 text-neutral-600 line-clamp-3">{r.expectedAnswer}</td>
              <td className="py-2 px-3 text-neutral-600 line-clamp-3">{r.generatedAnswer}</td>
              <td className="py-2 px-3 font-mono text-neutral-700">{r.llmScore.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
