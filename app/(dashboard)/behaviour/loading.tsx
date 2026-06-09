export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 h-64" />
        <div className="bg-white rounded-xl border border-slate-200 p-5 h-64" />
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-5 h-36">
        <div className="h-3 w-32 bg-slate-100 rounded mb-4" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-slate-50 rounded-xl h-20" />
          ))}
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-5 h-40" />
    </div>
  )
}
