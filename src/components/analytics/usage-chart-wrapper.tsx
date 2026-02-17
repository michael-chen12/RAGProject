'use client'

/**
 * Client-side wrapper for UsageChart.
 * Uses dynamic import with ssr:false to keep recharts out of the initial JS bundle.
 * This wrapper exists because dynamic({ ssr: false }) is not allowed in Server Components.
 */
import dynamic from 'next/dynamic'

const UsageChart = dynamic(
  () => import('./usage-chart'),
  {
    ssr: false,
    loading: () => (
      <div className="h-[256px] animate-pulse rounded-lg bg-neutral-100" />
    ),
  }
)

interface Props {
  data: { date: string; count: number }[]
}

export default function UsageChartWrapper({ data }: Props) {
  return <UsageChart data={data} />
}
