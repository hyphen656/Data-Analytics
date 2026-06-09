'use client'

import { usePathname } from 'next/navigation'
import { useState } from 'react'

const pageTitles: Record<string, string> = {
  '/overview': 'Overview',
  '/behaviour': 'User Behaviour',
  '/trends': 'Trends',
  '/predictions': 'Predictions',
}

const ranges = ['7d', '30d', '90d'] as const
type Range = (typeof ranges)[number]

export default function TopBar() {
  const pathname = usePathname()
  const [range, setRange] = useState<Range>('30d')

  const title = pageTitles[pathname] ?? 'Dashboard'

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0">
      <h1 className="text-sm font-semibold text-slate-800 tracking-tight">{title}</h1>
      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
        {ranges.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-150 ${
              range === r
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {r}
          </button>
        ))}
      </div>
    </header>
  )
}
