export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Image */}
      <div className="aspect-square w-full animate-pulse bg-slate-200" />
      {/* Body */}
      <div className="flex flex-col gap-2 p-3.5">
        <div className="h-3 w-1/3 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 flex items-center justify-between">
          <div className="h-5 w-1/3 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-12 animate-pulse rounded bg-slate-200" />
        </div>
      </div>
    </div>
  );
}

export function FilterSidebarSkeleton() {
  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2 border-b border-slate-100 pb-4">
          <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
          {[1, 2, 3].map((j) => (
            <div key={j} className="flex items-center gap-2">
              <div className="h-4 w-4 animate-pulse rounded bg-slate-200" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function GridSkeletons({ count = 24 }: { count?: number }) {
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: Math.min(count, 12) }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
