'use client'

/**
 * Line chart of daily chat volume.
 * Imported dynamically (ssr: false) by the dashboard page to keep recharts
 * out of the initial JS bundle.
 */
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface Props {
  data: { date: string; count: number }[]
}

export default function UsageChart({ data }: Props) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-neutral-700 mb-4">
        Chat Volume (last 30 days)
      </h2>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickFormatter={(v: string) => v.slice(5)} // MM-DD
          />
          <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
          <Tooltip
            contentStyle={{ fontSize: 12 }}
            labelFormatter={(label) => `Date: ${String(label)}`}
          />
          <Line
            type="monotone"
            dataKey="count"
            stroke="#6366f1"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
