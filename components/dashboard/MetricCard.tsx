interface MetricCardProps {
  title: string
  value: string | number
  delta?: string
  deltaLabel?: string
  positive?: boolean
}

export default function MetricCard({ title, value, delta, deltaLabel, positive }: MetricCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">{title}</p>
      <p className="text-3xl font-bold text-slate-900 font-mono tabular-nums">{value}</p>
      {delta && (
        <div className="flex items-center gap-1.5 mt-3">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
              positive
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {delta}
          </span>
          {deltaLabel && (
            <span className="text-xs text-slate-400">{deltaLabel}</span>
          )}
        </div>
      )}
    </div>
  )
}
