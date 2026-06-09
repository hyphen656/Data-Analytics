import { createServerClient } from '@/lib/supabase/server'
import PredictionBadge from '@/components/dashboard/PredictionBadge'

type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
type Trend = 'improving' | 'stable' | 'declining'

interface ChurnPrediction {
  churn_score: number
  days_since_last_session: number
  risk_level: RiskLevel
  signal: string
}

interface RevenuePrediction {
  forecast_30d: number
  forecast_90d: number
  confidence: number
  basis: string
}

interface EngagementPrediction {
  trend: Trend
  '7d_avg_sessions': number
  '30d_avg_sessions': number
  pct_change: number
}

interface PredictionRow {
  clerk_user_id: string
  model_type: string
  prediction: Record<string, unknown>
  created_at: string
}

export default async function PredictionsPage() {
  const supabase = await createServerClient()

  const { data: predictions } = await supabase
    .from('predictions')
    .select('clerk_user_id, model_type, prediction, created_at')
    .order('created_at', { ascending: false })

  const rows = (predictions as PredictionRow[] | null) ?? []

  const churnRows = rows.filter((r) => r.model_type === 'churn_v1')
  const revenueRows = rows.filter((r) => r.model_type === 'revenue_forecast_v1')
  const engagementRows = rows.filter((r) => r.model_type === 'engagement_trend_v1')

  const latestChurn = churnRows[0]
  const latestRevenue = revenueRows[0]
  const latestEngagement = engagementRows[0]

  return (
    <div className="space-y-6">
      {/* Churn risk */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">Churn Risk</p>
            <p className="text-xs text-slate-400">Model: churn_v1</p>
          </div>
          {latestChurn && (
            <span className="text-xs text-slate-400">
              Updated {new Date(latestChurn.created_at).toLocaleDateString()}
            </span>
          )}
        </div>
        {churnRows.length === 0 ? (
          <p className="text-sm text-slate-400">No churn predictions available</p>
        ) : (
          <div className="space-y-3">
            {churnRows.map((row, i) => {
              const p = row.prediction as unknown as ChurnPrediction
              return (
                <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-mono text-slate-600">
                      {row.clerk_user_id.slice(-3)}
                    </div>
                    <div>
                      <p className="text-xs font-mono text-slate-600">{row.clerk_user_id}</p>
                      <p className="text-xs text-slate-400">{p.days_since_last_session}d inactive · {p.signal}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold font-mono text-slate-700">
                      {(p.churn_score * 100).toFixed(0)}%
                    </span>
                    <PredictionBadge level={p.risk_level} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Revenue forecast */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">Revenue Forecast</p>
            <p className="text-xs text-slate-400">Model: revenue_forecast_v1</p>
          </div>
          {latestRevenue && (
            <span className="text-xs text-slate-400">
              Updated {new Date(latestRevenue.created_at).toLocaleDateString()}
            </span>
          )}
        </div>
        {revenueRows.length === 0 ? (
          <p className="text-sm text-slate-400">No revenue forecasts available</p>
        ) : (
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
            {revenueRows.map((row, i) => {
              const p = row.prediction as unknown as RevenuePrediction
              return (
                <div key={i} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-xs font-mono text-slate-500 mb-3">{row.clerk_user_id}</p>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-slate-400">30-day forecast</p>
                      <p className="text-xl font-bold font-mono text-slate-900">${p.forecast_30d}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">90-day forecast</p>
                      <p className="text-xl font-bold font-mono text-slate-900">${p.forecast_90d}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-slate-400">Confidence</p>
                      <p className="text-xs font-mono text-slate-600">{(p.confidence * 100).toFixed(0)}%</p>
                    </div>
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full"
                        style={{ width: `${p.confidence * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Engagement trends */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">Engagement Trends</p>
            <p className="text-xs text-slate-400">Model: engagement_trend_v1</p>
          </div>
          {latestEngagement && (
            <span className="text-xs text-slate-400">
              Updated {new Date(latestEngagement.created_at).toLocaleDateString()}
            </span>
          )}
        </div>
        {engagementRows.length === 0 ? (
          <p className="text-sm text-slate-400">No engagement data available</p>
        ) : (
          <div className="space-y-3">
            {engagementRows.map((row, i) => {
              const p = row.prediction as unknown as EngagementPrediction
              return (
                <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-mono text-slate-600">
                      {row.clerk_user_id.slice(-3)}
                    </div>
                    <div>
                      <p className="text-xs font-mono text-slate-600">{row.clerk_user_id}</p>
                      <p className="text-xs text-slate-400">
                        7d avg: {p['7d_avg_sessions']} · 30d avg: {p['30d_avg_sessions']} sessions
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-mono font-bold ${p.pct_change >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {p.pct_change >= 0 ? '+' : ''}{p.pct_change}%
                    </span>
                    <PredictionBadge level={p.trend} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
