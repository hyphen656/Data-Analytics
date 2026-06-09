'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface Props {
  events: { event_type: string; created_at: string }[]
}

const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#06b6d4', '#10b981', '#f59e0b']

export default function EventsByTypeChart({ events }: Props) {
  const counts: Record<string, number> = {}
  for (const e of events) {
    counts[e.event_type] = (counts[e.event_type] ?? 0) + 1
  }

  const data = Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  if (data.length === 0) {
    return <div className="h-48 flex items-center justify-center text-sm text-slate-400">No event data</div>
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ left: 0, right: 8 }}>
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#f1f5f9', fontSize: 12 }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
