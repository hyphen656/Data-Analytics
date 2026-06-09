import { createServerClient } from '@/lib/supabase/server'
import TrendLineChart from './TrendLineChart'
import RevenueChart from './RevenueChart'

export default async function TrendsPage() {
  const supabase = await createServerClient()

  const [{ data: events }, { data: paymentEvents }] = await Promise.all([
    supabase
      .from('events')
      .select('created_at, event_type')
      .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true }),
    supabase
      .from('events')
      .select('created_at, properties')
      .eq('event_type', 'payment_made')
      .order('created_at', { ascending: true }),
  ])

  const allEvents = events ?? []
  const payments = paymentEvents ?? []

  // Growth: this month vs last month
  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  const thisMonth = allEvents.filter((e) => new Date(e.created_at) >= thisMonthStart).length
  const lastMonth = allEvents.filter(
    (e) => new Date(e.created_at) >= lastMonthStart && new Date(e.created_at) < thisMonthStart
  ).length
  const growthPct = lastMonth > 0 ? (((thisMonth - lastMonth) / lastMonth) * 100).toFixed(1) : null

  return (
    <div className="space-y-6">
      {/* Growth summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">This Month</p>
          <p className="text-3xl font-bold font-mono text-slate-900">{thisMonth}</p>
          <p className="text-xs text-slate-400 mt-1">events</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Last Month</p>
          <p className="text-3xl font-bold font-mono text-slate-900">{lastMonth}</p>
          <p className="text-xs text-slate-400 mt-1">events</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Growth</p>
          <p className={`text-3xl font-bold font-mono ${growthPct && parseFloat(growthPct) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {growthPct ? `${parseFloat(growthPct) >= 0 ? '+' : ''}${growthPct}%` : '—'}
          </p>
          <p className="text-xs text-slate-400 mt-1">month over month</p>
        </div>
      </div>

      {/* Trend line */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-800 mb-1">Daily Event Volume</p>
        <p className="text-xs text-slate-400 mb-4">Last 30 days</p>
        <TrendLineChart events={allEvents} />
      </div>

      {/* Revenue chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-800 mb-1">Monthly Revenue</p>
        <p className="text-xs text-slate-400 mb-4">From payment_made events</p>
        <RevenueChart payments={payments} />
      </div>
    </div>
  )
}
