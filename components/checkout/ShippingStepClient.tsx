'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { PriceView } from '@/components/currency/PriceView';
import type { DisplayCurrency } from '@/types/currency';
import type { ShippingMethodDTO } from '@/types/shipping';

type ShippingStepClientProps = {
  orderId: string;
  locale: string;
  /** Legacy ISO code of the order currency (always AED); kept for callers. */
  currency: string;
  /** Display-currency snapshot used to format the shipping method prices. */
  display: DisplayCurrency;
  addressId: string;
  methods: ShippingMethodDTO[];
  initialSelectedId: string | null;
};

export function ShippingStepClient({
  orderId,
  locale,
  currency,
  display,
  addressId,
  methods,
  initialSelectedId
}: ShippingStepClientProps) {
  const t = useTranslations('shipping');
  const tc = useTranslations('checkout');
  const router = useRouter();

  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId ?? methods[0]?.id ?? null
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    if (!selectedId) {
      setError(t('errorSelectRequired'));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/shipping/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          addressId,
          shippingMethodId: selectedId
        })
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        throw new Error(payload.message ?? payload.error ?? `status ${res.status}`);
      }
      router.push(`/${locale}/checkout/${orderId}/pay`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
      setSubmitting(false);
    }
  }

  if (methods.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        <p className="font-semibold">{t('noneAvailableTitle')}</p>
        <p className="mt-0.5">{t('noneAvailableMessage')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ul className="space-y-3">
        {methods.map((m) => {
          const checked = selectedId === m.id;
          return (
            <li key={m.id}>
              <label
                className={
                  'flex cursor-pointer items-start gap-4 rounded-2xl border p-4 transition ' +
                  (checked
                    ? 'border-slate-900 bg-slate-50 shadow-sm ring-1 ring-slate-900'
                    : 'border-slate-200 bg-white hover:border-slate-300')
                }
              >
                <input
                  type="radio"
                  name="shipping"
                  value={m.id}
                  checked={checked}
                  onChange={() => setSelectedId(m.id)}
                  className="mt-1 h-4 w-4 flex-none accent-slate-900"
                />
                <div className="flex flex-1 items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{m.name}</span>
                    </div>
                    {m.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                        {m.description}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-slate-500">
                      {m.estimatedDays === 0
                        ? t('sameDay')
                        : t('estimatedDays', { days: m.estimatedDays })}
                    </p>
                    {(m.basePrice !== null || m.pricePerKg !== null) && (
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {m.basePrice !== null && (
                          <span>
                            {t('breakdownBase')}:{' '}
                            <PriceView amount={m.basePrice} display={display} />
                          </span>
                        )}
                        {m.pricePerKg !== null && (
                          <span>
                            {' · '}
                            <PriceView amount={m.pricePerKg} display={display} />
                            {' / kg'}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex-none text-end">
                    <div className="text-lg font-bold text-slate-900">
                      {m.price === 0 ? (
                        <span className="text-emerald-600">{t('free')}</span>
                      ) : (
                        <PriceView amount={m.price} display={display} />
                      )}
                    </div>
                  </div>
                </div>
              </label>
            </li>
          );
        })}
      </ul>

      {error && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between border-t border-slate-100 pt-5">
        <button
          type="button"
          onClick={() => router.push(`/${locale}/checkout/${orderId}/address`)}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
        >
          {tc('back')}
        </button>
        <button
          type="button"
          onClick={handleContinue}
          disabled={!selectedId || submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {submitting ? tc('saving') : tc('continueToPayment')}
          <ArrowIcon />
        </button>
      </div>
    </div>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}
