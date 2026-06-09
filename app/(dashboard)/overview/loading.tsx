export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 h-28">
            <div className="h-3 w-20 bg-slate-100 rounded mb-4" />
            <div className="h-8 w-16 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 h-64" />
        <div className="bg-white rounded-xl border border-slate-200 p-5 h-64" />
      </div>
    </div>
  )
}
