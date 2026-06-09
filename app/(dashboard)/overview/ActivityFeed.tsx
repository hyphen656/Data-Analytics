'use client'

const EVENT_COLORS: Record<string, string> = {
  page_view: 'bg-blue-400',
  sign_up: 'bg-emerald-400',
  question_asked: 'bg-indigo-400',
  answer_given: 'bg-violet-400',
  payment_made: 'bg-amber-400',
  session_end: 'bg-slate-400',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

interface Props {
  events: { event_type: string; created_at: string }[]
}

export default function ActivityFeed({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-slate-400">
        No recent activity
      </div>
    )
  }

  return (
    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
      {events.map((e, i) => (
        <div key={i} className="flex items-center gap-3 py-1.5">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${EVENT_COLORS[e.event_type] ?? 'bg-slate-300'}`} />
          <span className="text-sm text-slate-700 flex-1 font-mono">{e.event_type}</span>
          <span className="text-xs text-slate-400 flex-shrink-0">{timeAgo(e.created_at)}</span>
        </div>
      ))}
    </div>
  )
}
