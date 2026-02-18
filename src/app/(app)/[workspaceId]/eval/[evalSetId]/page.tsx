import Link from 'next/link'
import { requireAuth, requireWorkspaceMember } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { getEvalSets, getEvalRunsForSet, getEvalCasesForSet } from '@/lib/queries/eval'
import { EvalRunButton } from '@/components/eval/eval-run-button'
import { EvalResultsTable } from '@/components/eval/eval-results-table'
import type { EvalCaseResult } from '@/lib/eval/runner'

type PageProps = {
  params: Promise<{ workspaceId: string; evalSetId: string }>
}

export const metadata = { title: 'Eval Set Detail' }

export default async function EvalDetailPage({ params }: PageProps) {
  const { workspaceId, evalSetId } = await params
  const user = await requireAuth()
  const supabase = await createClient()
  const membership = await requireWorkspaceMember(supabase, workspaceId, user.id)

  const isAdmin = membership.role === 'admin'

  const [evalSets, runs, cases] = await Promise.all([
    getEvalSets(supabase, workspaceId),
    getEvalRunsForSet(supabase, evalSetId),
    getEvalCasesForSet(supabase, evalSetId),
  ])

  const evalSet = evalSets.find((s) => s.id === evalSetId)
  if (!evalSet) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <p className="text-sm text-neutral-400">Eval set not found.</p>
        <Link href={`/${workspaceId}/eval`} className="text-sm text-blue-600 hover:underline mt-2 inline-block">
          ← Back to eval sets
        </Link>
      </div>
    )
  }

  const latestRun = runs[0] ?? null
  const latestRunDetails = latestRun?.details
    ? (latestRun.details as unknown as EvalCaseResult[])
    : []

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/${workspaceId}/eval`}
            className="text-xs text-neutral-400 hover:text-neutral-600 mb-1 inline-block"
          >
            ← Back to eval sets
          </Link>
          <h1 className="text-xl font-semibold text-neutral-900">{evalSet.name}</h1>
          <p className="text-sm text-neutral-400 mt-0.5">
            {cases.length} {cases.length === 1 ? 'case' : 'cases'} · {runs.length}{' '}
            {runs.length === 1 ? 'run' : 'runs'}
          </p>
        </div>
        {isAdmin && (
          <EvalRunButton
            evalSetId={evalSetId}
            workspaceId={workspaceId}
            totalCases={cases.length}
          />
        )}
      </div>

      {/* Run history */}
      <section>
        <h2 className="text-sm font-medium text-neutral-700 mb-3">Run History</h2>
        {runs.length === 0 ? (
          <p className="text-sm text-neutral-400">No runs yet. Click Run to evaluate this set.</p>
        ) : (
          <div className="border border-neutral-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  <th className="py-2 px-3 text-left text-xs font-medium text-neutral-500">
                    Date
                  </th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-neutral-500">
                    Recall@{runs[0]?.k_value ?? 5}
                  </th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-neutral-500">
                    Accuracy
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {runs.map((run) => (
                  <tr key={run.id} className="bg-white">
                    <td className="py-2 px-3 text-neutral-600">
                      {new Date(run.created_at).toLocaleString()}
                    </td>
                    <td className="py-2 px-3 font-mono text-neutral-700">
                      {run.recall_at_k !== null
                        ? (run.recall_at_k * 100).toFixed(1) + '%'
                        : '—'}
                    </td>
                    <td className="py-2 px-3 font-mono text-neutral-700">
                      {run.answer_accuracy !== null
                        ? (run.answer_accuracy * 100).toFixed(1) + '%'
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Per-case results from latest run */}
      {latestRunDetails.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-neutral-700 mb-3">
            Latest Run — Per-Case Results
          </h2>
          <div className="border border-neutral-200 rounded-lg overflow-hidden">
            <EvalResultsTable results={latestRunDetails} />
          </div>
        </section>
      )}
    </div>
  )
}
