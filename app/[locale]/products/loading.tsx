import { LoadingSkeleton } from '@/components/products/LoadingSkeleton';

export default function Loading() {
  return (
    <section className="space-y-6">
      <div className="h-8 w-40 animate-pulse rounded bg-slate-200" />
      <LoadingSkeleton />
    </section>
  );
}
