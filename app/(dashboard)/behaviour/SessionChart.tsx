'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface Session {
  started_at: string
  ended_at: string | null
}

interface Props {
  sessions: Session[]
}

export default function SessionChart({ sessions }: Props) {
  const data = sessions
    .filter((s) => s.ended_at)
    .map((s) => {
      const duration = (new Date(s.ended_at!).getTime() - new Date(s.started_at).getTime()) / 60000
      return {
        date: new Date(s.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        duration: Math.round(duration),
      }
    })
    .slice(0, 30)
    .reverse()

  if (data.length === 0) {
    return <div className="h-48 flex items-center justify-center text-sm text-slate-400">No session data</div>
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ left: 0, right: 8 }}>
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit="m" />
        <Tooltip
          contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#f1f5f9', fontSize: 12 }}
          formatter={(v) => [`${v}m`, 'Duration']}
        />
        <Line type="monotone" dataKey="duration" stroke="#6366f1" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
