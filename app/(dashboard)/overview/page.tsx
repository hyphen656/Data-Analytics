import { createServerClient } from '@/lib/supabase/server'
import MetricCard from '@/components/dashboard/MetricCard'
import EventsBarChart from './EventsBarChart'
import ActivityFeed from './ActivityFeed'

export default async function OverviewPage() {
  const supabase = await createServerClient()

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [
    { count: dau },
    { count: wau },
    { count: mau },
    { data: recentEvents },
    { data: allTodayEvents },
  ] = await Promise.all([
    supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString()),
    supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    supabase
      .from('events')
      .select('event_type, created_at, properties')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('events')
      .select('event_type')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
  ])

  const dauVal = dau ?? 0
  const mauVal = mau ?? 0
  const stickinessRatio = mauVal > 0 ? ((dauVal / mauVal) * 100).toFixed(1) + '%' : '—'

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard title="DAU" value={dauVal} delta="+0%" deltaLabel="vs yesterday" positive={true} />
        <MetricCard title="WAU" value={wau ?? 0} delta="+0%" deltaLabel="vs last week" positive={true} />
        <MetricCard title="MAU" value={mauVal} delta="+0%" deltaLabel="vs last month" positive={true} />
        <MetricCard title="Stickiness (DAU/MAU)" value={stickinessRatio} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Top events bar chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-800 mb-1">Top Events</p>
          <p className="text-xs text-slate-400 mb-4">Last 24 hours</p>
          <EventsBarChart events={allTodayEvents ?? []} />
        </div>

        {/* Activity feed */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-800 mb-1">Live Activity</p>
          <p className="text-xs text-slate-400 mb-4">Last 20 events</p>
          <ActivityFeed events={recentEvents ?? []} />
        </div>
      </div>
    </div>
  )
}
