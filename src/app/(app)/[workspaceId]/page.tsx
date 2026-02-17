import { Suspense } from 'react'
import { requireAuth } from '@/lib/auth/guards'
import { requireWorkspaceMember } from '@/lib/auth/guards'
import { getWorkspace } from '@/lib/queries/workspaces'
import {
  getChatVolumeByDay,
  getFeedbackSummary,
  getMissingKbEntries,
  getTopQueries,
} from '@/lib/queries/analytics'
import { createClient } from '@/lib/supabase/server'
import FeedbackSummary from '@/components/analytics/feedback-summary'
import MissingKbTable from '@/components/analytics/missing-kb-table'
import UsageChartWrapper from '@/components/analytics/usage-chart-wrapper'

// ── Skeleton used while async data loads ──────────────────────────────────────
function CardSkeleton() {
  return <div className="h-40 animate-pulse rounded-lg bg-neutral-100" />
}

// ── Top Queries sub-component (rendered inline) ────────────────────────────
function TopQueriesCard({ data }: { data: { content: string; count: number }[] }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-neutral-700 mb-4">Top Queries</h2>
      {data.length === 0 ? (
        <p className="text-sm text-neutral-400">No queries yet.</p>
      ) : (
        <ol className="space-y-2">
          {data.map((q, i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
              <span className="text-neutral-400 w-4 shrink-0">{i + 1}.</span>
              <span className="text-neutral-800 flex-1 truncate">{q.content}</span>
              <span className="text-neutral-400 shrink-0">{q.count}×</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

export default async function WorkspaceHomePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params
  const user = await requireAuth()
  const supabase = await createClient()

  await requireWorkspaceMember(supabase, workspaceId, user.id)

  // Fetch workspace name + all 4 analytics queries in parallel
  const [workspace, chatVolume, feedback, missingEntries, topQueries] =
    await Promise.all([
      getWorkspace(supabase, workspaceId),
      getChatVolumeByDay(supabase, workspaceId, 30),
      getFeedbackSummary(supabase, workspaceId),
      getMissingKbEntries(supabase, workspaceId),
      getTopQueries(supabase, workspaceId),
    ])

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">
          {workspace?.name ?? 'Workspace'}
        </h1>
        <p className="text-sm text-neutral-500 mt-1">
          Analytics overview · Welcome back, {user.email}
        </p>
      </div>

      {/* Usage chart (recharts — client only via wrapper) */}
      <Suspense fallback={<CardSkeleton />}>
        <UsageChartWrapper data={chatVolume} />
      </Suspense>

      {/* Two-column grid: feedback + top queries */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Suspense fallback={<CardSkeleton />}>
          <FeedbackSummary data={feedback} />
        </Suspense>
        <Suspense fallback={<CardSkeleton />}>
          <TopQueriesCard data={topQueries} />
        </Suspense>
      </div>

      {/* Missing KB entries table */}
      <Suspense fallback={<CardSkeleton />}>
        <MissingKbTable entries={missingEntries} />
      </Suspense>
    </div>
  )
}
