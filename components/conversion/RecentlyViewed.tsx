'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { formatPrice } from '@/lib/currency/service';
import type { Currency } from '@/types/currency';
import { useRecentlyViewed, recordView, type RecentlyViewedEntry } from '@/hooks/useRecentlyViewed';
import { ProductImage } from '@/components/products/ProductImage';

/* ── Record current product on mount ──────────────────────────────────── */

type RecorderProps = {
  entry: RecentlyViewedEntry;
};

export function ViewRecorder({ entry }: RecorderProps) {
  useEffect(() => {
    recordView(entry);
  }, [entry]);
  return null;
}

/* ── Recently viewed shelf ────────────────────────────────────────────── */

type ShelfProps = {
  currentSlug?: string;
  locale: string;
  title?: string;
};

export function RecentlyViewedShelf({ currentSlug, locale, title = 'Recently Viewed' }: ShelfProps) {
  const items = useRecentlyViewed(currentSlug);
  if (items.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="mb-4 text-base font-bold text-slate-900">{title}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {items.slice(0, 6).map((item) => (
          <Link
            key={item.slug}
            href={`/${locale}/products/${item.slug}`}
            className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <ProductImage
              title={item.title}
              src={item.imageUrl ?? undefined}
              aspect="aspect-square"
              zoomOnHover={false}
            />
            <div className="p-2.5">
              <p className="line-clamp-2 text-[11px] font-medium leading-snug text-slate-800 group-hover:text-indigo-700">
                {item.title}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-900">
                {formatPrice(item.price, (item.currency as Currency) || 'AED', locale)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
