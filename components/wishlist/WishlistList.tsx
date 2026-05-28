'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';

import type { WishlistItemWithProduct } from '@/lib/wishlist/service';

/**
 * The wishlist row needs a price string but must NOT import the
 * server-only `<Price>`. We accept a pre-formatted price keyed by
 * item id, computed on the server with the active display currency.
 */
type Props = {
  items: WishlistItemWithProduct[];
  locale: string;
  formattedPrices: Record<string, string>;
};

export function WishlistList({ items, locale, formattedPrices }: Props) {
  const t = useTranslations('wishlist');
  const router = useRouter();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function handleRemove(itemId: string, productId: string) {
    setPendingDeleteId(itemId);
    try {
      const res = await fetch('/api/wishlist/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId })
      });
      if (!res.ok) throw new Error('remove_failed');
      startTransition(() => router.refresh());
    } catch {
      // Rollback UI (not implemented here; full page refresh will reconcile)
    } finally {
      setPendingDeleteId(null);
    }
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const p = item.product;
        return (
          <article
            key={item.id}
            className="flex flex-wrap items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300"
          >
            <Link
              href={`/${locale}/products/${p.slug}`}
              className="h-20 w-20 flex-none overflow-hidden rounded-lg bg-slate-100"
            >
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.imageUrl}
                  alt={p.title}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </Link>

            <div className="flex min-w-0 flex-1">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/${locale}/products/${p.slug}`}
                  className="line-clamp-2 text-sm font-semibold text-slate-900 transition hover:text-indigo-700"
                >
                  {p.title}
                </Link>
                <p className="mt-1 text-xs text-slate-500">
                  {p.supplier?.name ?? '—'}
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {formattedPrices[item.id] ?? ''}
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleRemove(item.id, p.id)}
                disabled={pendingDeleteId === item.id}
                className="ms-4 flex-none rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60"
              >
                {pendingDeleteId === item.id
                  ? t('page.removing')
                  : t('page.remove')}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
