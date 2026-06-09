export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="h-3 w-24 bg-slate-100 rounded mb-2" />
          <div className="h-2 w-32 bg-slate-50 rounded mb-6" />
          <div className="space-y-3">
            {[...Array(3)].map((_, j) => (
              <div key={j} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100" />
                  <div>
                    <div className="h-2.5 w-28 bg-slate-100 rounded mb-1.5" />
                    <div className="h-2 w-20 bg-slate-50 rounded" />
                  </div>
                </div>
                <div className="h-6 w-16 bg-slate-100 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
