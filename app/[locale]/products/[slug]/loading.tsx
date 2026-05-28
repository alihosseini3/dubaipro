export default function Loading() {
  return (
    <div className="space-y-10">
      <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="aspect-[4/3] w-full animate-pulse rounded-2xl bg-slate-200" />
          <div className="mt-3 grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square animate-pulse rounded-lg bg-slate-100"
              />
            ))}
          </div>
        </div>

        <div className="space-y-4 lg:col-span-4">
          <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
          <div className="h-8 w-3/4 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
          <div className="h-40 w-full animate-pulse rounded-xl bg-slate-100" />
        </div>

        <div className="lg:col-span-3">
          <div className="h-72 w-full animate-pulse rounded-2xl bg-slate-200" />
        </div>
      </div>
    </div>
  );
}
