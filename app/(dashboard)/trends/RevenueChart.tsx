'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface Props {
  payments: { created_at: string; properties: Record<string, unknown> }[]
}

export default function RevenueChart({ payments }: Props) {
  const monthly: Record<string, number> = {}

  for (const p of payments) {
    const month = new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    const amount = typeof p.properties?.amount === 'number' ? p.properties.amount : 0
    monthly[month] = (monthly[month] ?? 0) + amount
  }

  const data = Object.entries(monthly).map(([month, revenue]) => ({ month, revenue }))

  if (data.length === 0) {
    return <div className="h-48 flex items-center justify-center text-sm text-slate-400">No revenue data</div>
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ left: 0, right: 8 }}>
        <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
        <Tooltip
          contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#f1f5f9', fontSize: 12 }}
          formatter={(v) => [`$${v}`, 'Revenue']}
        />
        <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
