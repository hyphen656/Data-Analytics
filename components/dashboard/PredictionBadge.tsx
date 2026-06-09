type Level = 'low' | 'medium' | 'high' | 'critical' | 'improving' | 'stable' | 'declining'

const styles: Record<Level, string> = {
  low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  critical: 'bg-red-50 text-red-700 border-red-200',
  improving: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  stable: 'bg-blue-50 text-blue-700 border-blue-200',
  declining: 'bg-red-50 text-red-700 border-red-200',
}

export default function PredictionBadge({ level }: { level: Level }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${styles[level]}`}>
      {level}
    </span>
  )
}
