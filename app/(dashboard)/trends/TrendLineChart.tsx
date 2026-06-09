'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface Props {
  events: { created_at: string }[]
}

export default function TrendLineChart({ events }: Props) {
  const counts: Record<string, number> = {}
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000

  for (const e of events) {
    if (new Date(e.created_at).getTime() < cutoff) continue
    const day = new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    counts[day] = (counts[day] ?? 0) + 1
  }

  const data = Object.entries(counts).map(([date, count]) => ({ date, count }))

  if (data.length === 0) {
    return <div className="h-48 flex items-center justify-center text-sm text-slate-400">No trend data</div>
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ left: 0, right: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#f1f5f9', fontSize: 12 }}
        />
        <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
