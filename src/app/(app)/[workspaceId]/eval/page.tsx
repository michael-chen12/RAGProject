import Link from 'next/link'
import { requireAuth, requireWorkspaceMember } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { getEvalSets, getEvalCasesForSet } from '@/lib/queries/eval'
import { EvalRunButton } from '@/components/eval/eval-run-button'

type PageProps = { params: Promise<{ workspaceId: string }> }

export const metadata = { title: 'RAG Evaluation' }

export default async function EvalPage({ params }: PageProps) {
  const { workspaceId } = await params
  const user = await requireAuth()
  const supabase = await createClient()
  const membership = await requireWorkspaceMember(supabase, workspaceId, user.id)

  const isAdmin = membership.role === 'admin'
  const evalSets = await getEvalSets(supabase, workspaceId)

  // Fetch case counts for each set
  const setsWithCounts = await Promise.all(
    evalSets.map(async (set) => {
      const cases = await getEvalCasesForSet(supabase, set.id)
      return { ...set, caseCount: cases.length }
    })
  )

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-neutral-900">RAG Evaluation</h1>
        <p className="text-sm text-neutral-400 mt-0.5">
          Measure retrieval quality (recall@k) and answer accuracy
        </p>
      </div>

      {evalSets.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 border border-dashed border-neutral-200 rounded-lg">
          <p className="text-sm text-neutral-400">No eval sets yet.</p>
          <p className="text-xs text-neutral-400">
            Add eval cases to the database to get started.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-neutral-200 border border-neutral-200 rounded-lg overflow-hidden">
          {setsWithCounts.map((set) => (
            <div
              key={set.id}
              className="flex items-center justify-between px-4 py-3 bg-white hover:bg-neutral-50"
            >
              <Link href={`/${workspaceId}/eval/${set.id}`} className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-900 truncate">{set.name}</p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {set.caseCount} {set.caseCount === 1 ? 'case' : 'cases'} ·{' '}
                  {new Date(set.created_at).toLocaleDateString()}
                </p>
              </Link>

              {isAdmin && (
                <div className="ml-4 shrink-0">
                  <EvalRunButton
                    evalSetId={set.id}
                    workspaceId={workspaceId}
                    totalCases={set.caseCount}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
