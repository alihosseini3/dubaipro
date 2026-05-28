export default function RfqDetailLoading() {
  return (
    <main className="min-h-screen bg-white py-10">
      <div className="mx-auto max-w-5xl px-4">
        <div className="flex flex-col gap-8 lg:flex-row">
          <div className="flex-1 space-y-5">
            <div className="h-3 w-40 animate-pulse rounded bg-slate-200" />
            <div className="flex gap-2">
              <div className="h-5 w-16 animate-pulse rounded-full bg-slate-200" />
              <div className="h-5 w-20 animate-pulse rounded-full bg-slate-200" />
            </div>
            <div className="h-8 w-3/4 animate-pulse rounded-xl bg-slate-200" />
            <div className="h-32 animate-pulse rounded-2xl bg-slate-200" />
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-200" />
              ))}
            </div>
          </div>
          <aside className="w-full space-y-4 lg:w-72 lg:shrink-0">
            <div className="h-12 animate-pulse rounded-2xl bg-slate-200" />
            <div className="h-40 animate-pulse rounded-2xl bg-slate-200" />
          </aside>
        </div>
      </div>
    </main>
  );
}
