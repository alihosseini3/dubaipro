'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { PriceView } from '@/components/currency/PriceView';
import type { CartDTO } from '@/types/cart';
import type { DisplayCurrency } from '@/types/currency';

type CouponPanelProps = {
  /** Current cart. The parent is the source of truth for `coupon`. */
  cart: CartDTO;
  /** Called with the refreshed cart after an apply/remove roundtrip. */
  onChange: (cart: CartDTO) => void;
  /** Display-currency snapshot for formatting the fixed-discount label. */
  display: DisplayCurrency;
};

/**
 * Coupon input shown on the cart page.
 *
 * - If no coupon is applied: shows input + Apply button
 * - If a coupon is applied:   shows code + discount + Remove button
 *
 * All validation is server-authoritative; the client only surfaces the
 * localized error returned by the API.
 */
export function CouponPanel({ cart, onChange, display }: CouponPanelProps) {
  const t = useTranslations('coupon');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) {
      setError('coupon_invalid_input');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/coupon/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() })
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: CartDTO;
        error?: string;
      };
      if (!res.ok) {
        setError(json.error ?? 'errorGeneric');
        return;
      }
      if (json.data) {
        onChange(json.data);
        setCode('');
      }
    } catch {
      setError('errorGeneric');
    } finally {
      setSubmitting(false);
    }
  }

  async function remove() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/coupon/remove', { method: 'POST' });
      const json = (await res.json().catch(() => ({}))) as { data?: CartDTO };
      if (res.ok && json.data) onChange(json.data);
    } catch {
      setError('errorGeneric');
    } finally {
      setSubmitting(false);
    }
  }

  if (cart.coupon) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <TagIcon />
              <span className="font-mono text-sm font-bold text-emerald-900">
                {cart.coupon.code}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-emerald-700">
              {cart.coupon.type === 'PERCENTAGE' ? (
                t('appliedPercentage', { value: cart.coupon.value })
              ) : (
                <>
                  {t('appliedFixedPrefix')}{' '}
                  <PriceView amount={cart.coupon.value} display={display} />
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={remove}
            disabled={submitting}
            className="text-xs font-semibold text-emerald-800 transition hover:text-emerald-900 disabled:opacity-50"
          >
            {t('remove')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <form onSubmit={apply} className="flex gap-2" noValidate>
        <input
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            if (error) setError(null);
          }}
          placeholder={t('inputPlaceholder')}
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono uppercase tracking-wider outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900 focus:ring-offset-1"
          disabled={submitting}
          maxLength={32}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="submit"
          disabled={submitting || !code.trim()}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {submitting ? t('applying') : t('apply')}
        </button>
      </form>
      {error && (
        <p role="alert" className="text-xs font-medium text-red-600">
          {translateError(t, error)}
        </p>
      )}
    </div>
  );
}

function translateError(
  t: ReturnType<typeof useTranslations>,
  code: string
): string {
  // Map known server codes to localized messages; fall back to generic.
  const known = [
    'coupon_not_found',
    'coupon_inactive',
    'coupon_expired',
    'coupon_usage_limit_reached',
    'coupon_min_order_not_met',
    'coupon_invalid_input',
    'cart_empty'
  ];
  return known.includes(code) ? t(`error_${code}`) : t('errorGeneric');
}

function TagIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 text-emerald-700"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <circle cx="7" cy="7" r="1.5" fill="currentColor" />
    </svg>
  );
}
