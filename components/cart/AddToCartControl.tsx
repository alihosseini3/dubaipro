'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

type AddToCartControlProps = {
  productId: string;
  locale: string;
  inStock: boolean;
  maxQuantity?: number;
};

/**
 * Qty stepper + "Add to cart" button.
 * - Disabled when out of stock.
 * - Redirects guests to /login with a `?from=` return path.
 * - Shows success message then clears after 2s.
 */
export function AddToCartControl({
  productId,
  locale,
  inStock,
  maxQuantity
}: AddToCartControlProps) {
  const t = useTranslations('cart');
  const router = useRouter();

  const cap = Math.min(maxQuantity && maxQuantity > 0 ? maxQuantity : 999, 999);
  const [qty, setQty] = useState(1);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<
    | { type: 'idle' }
    | { type: 'success' }
    | { type: 'error'; message: string }
  >({ type: 'idle' });

  function bump(delta: number) {
    setQty((q) => Math.min(cap, Math.max(1, q + delta)));
  }

  async function handleAdd() {
    setPending(true);
    setStatus({ type: 'idle' });
    try {
      const res = await fetch('/api/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity: qty })
      });

      if (res.status === 401) {
        router.push(
          `/${locale}/login?from=${encodeURIComponent(
            typeof window !== 'undefined' ? window.location.pathname : ''
          )}`
        );
        return;
      }

      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error ?? `status ${res.status}`);
      }

      setStatus({ type: 'success' });
      router.refresh();
      setTimeout(() => setStatus({ type: 'idle' }), 2000);
    } catch (err) {
      setStatus({
        type: 'error',
        message: err instanceof Error ? err.message : t('errorGeneric')
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-stretch gap-2">
        <div className="inline-flex items-center rounded-lg border border-slate-300 bg-white">
          <button
            type="button"
            onClick={() => bump(-1)}
            disabled={qty <= 1 || !inStock}
            className="px-3 py-2 text-slate-700 transition hover:bg-slate-100 disabled:text-slate-300"
            aria-label={t('decrease')}
          >
            −
          </button>
          <span className="min-w-[2.5rem] border-x border-slate-200 px-3 py-2 text-center text-sm font-semibold text-slate-900">
            {qty}
          </span>
          <button
            type="button"
            onClick={() => bump(+1)}
            disabled={qty >= cap || !inStock}
            className="px-3 py-2 text-slate-700 transition hover:bg-slate-100 disabled:text-slate-300"
            aria-label={t('increase')}
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={handleAdd}
          disabled={!inStock || pending}
          className="inline-flex flex-1 items-center justify-center rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {pending ? t('adding') : t('addToCart')}
        </button>
      </div>

      {status.type === 'success' && (
        <p className="text-xs font-medium text-emerald-700">{t('addedToCart')}</p>
      )}
      {status.type === 'error' && (
        <p className="text-xs font-medium text-red-600">{status.message}</p>
      )}
    </div>
  );
}
