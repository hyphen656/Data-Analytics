import { createServerClient } from '@/lib/supabase/server'
import SessionChart from './SessionChart'
import EventsByTypeChart from './EventsByTypeChart'

interface Session {
  started_at: string
  ended_at: string | null
  device: string | null
  country: string | null
}

interface Funnel {
  id: string
  name: string
  steps: string[]
}

export default async function BehaviourPage() {
  const supabase = await createServerClient()

  const [
    { data: sessions },
    { data: events },
    { data: funnels },
  ] = await Promise.all([
    supabase
      .from('sessions')
      .select('started_at, ended_at, device, country')
      .order('started_at', { ascending: false })
      .limit(100),
    supabase
      .from('events')
      .select('event_type, created_at')
      .order('created_at', { ascending: false })
      .limit(500),
    supabase.from('funnels').select('id, name, steps'),
  ])

  const sessionData = (sessions as Session[] | null) ?? []
  const eventData = (events as { event_type: string; created_at: string }[] | null) ?? []
  const funnelData = (funnels as Funnel[] | null) ?? []

  // Device breakdown
  const deviceCounts: Record<string, number> = {}
  for (const s of sessionData) {
    if (s.device) deviceCounts[s.device] = (deviceCounts[s.device] ?? 0) + 1
  }
  const totalSessions = sessionData.length

  return (
    <div className="space-y-6">
      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-800 mb-1">Session Duration</p>
          <p className="text-xs text-slate-400 mb-4">Minutes per session over time</p>
          <SessionChart sessions={sessionData} />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-800 mb-1">Events by Type</p>
          <p className="text-xs text-slate-400 mb-4">Last 500 events</p>
          <EventsByTypeChart events={eventData} />
        </div>
      </div>

      {/* Device breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-800 mb-4">Device Breakdown</p>
        {totalSessions === 0 ? (
          <p className="text-sm text-slate-400">No session data</p>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {['desktop', 'mobile', 'tablet'].map((device) => {
              const count = deviceCounts[device] ?? 0
              const pct = totalSessions > 0 ? ((count / totalSessions) * 100).toFixed(0) : '0'
              return (
                <div key={device} className="text-center p-4 bg-slate-50 rounded-xl">
                  <p className="text-2xl font-bold font-mono text-slate-900">{pct}%</p>
                  <p className="text-xs text-slate-500 mt-1 capitalize">{device}</p>
                  <p className="text-xs text-slate-400">{count} sessions</p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Funnels */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-800 mb-4">Conversion Funnels</p>
        {funnelData.length === 0 ? (
          <p className="text-sm text-slate-400">No funnels defined</p>
        ) : (
          <div className="space-y-6">
            {funnelData.map((funnel) => (
              <div key={funnel.id}>
                <p className="text-xs font-medium text-slate-600 mb-3">{funnel.name}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {funnel.steps.map((step: string, i: number) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-1.5">
                        <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">
                          {i + 1}
                        </span>
                        <span className="text-xs font-mono text-indigo-700">{step}</span>
                      </div>
                      {i < funnel.steps.length - 1 && (
                        <span className="text-slate-300 text-sm">→</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
