'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import type { ShippingQuoteBreakdown } from '@/types/shipping';

type Result = {
  quote: ShippingQuoteBreakdown | null;
  candidates: ShippingQuoteBreakdown[];
};

/**
 * Admin "test shipping cost" widget.
 *
 * POSTs to /api/shipping/quote with one synthetic line item so admins can
 * sanity-check rule resolution without creating a real cart/order.
 */
export function ShippingTesterCard() {
  const t = useTranslations('admin.shipping');
  const [country, setCountry] = useState('AE');
  const [weight, setWeight] = useState('1');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [qty, setQty] = useState('1');
  const [shippingClass, setShippingClass] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/shipping/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country: country.trim().toUpperCase(),
          items: [
            {
              weight: weight === '' ? null : Number(weight),
              length: length === '' ? null : Number(length),
              width: width === '' ? null : Number(width),
              height: height === '' ? null : Number(height),
              shippingClass: shippingClass.trim() || null,
              quantity: Number(qty) || 1
            }
          ]
        })
      });
      const json = (await res.json()) as { data?: Result; error?: string };
      if (!res.ok || !json.data) {
        throw new Error(json.error ?? 'failed');
      }
      setResult(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed');
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none';

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-700">
            {t('testerCountry')}
          </label>
          <input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className={inputCls}
            placeholder="AE"
            maxLength={4}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-700">
            {t('testerWeight')}
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-700">
            {t('testerQty')}
          </label>
          <input
            type="number"
            min="1"
            step="1"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="sm:col-span-3 grid grid-cols-3 gap-3">
          <input
            type="number"
            min="0"
            value={length}
            onChange={(e) => setLength(e.target.value)}
            placeholder={t('testerLength')}
            className={inputCls}
          />
          <input
            type="number"
            min="0"
            value={width}
            onChange={(e) => setWidth(e.target.value)}
            placeholder={t('testerWidth')}
            className={inputCls}
          />
          <input
            type="number"
            min="0"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            placeholder={t('testerHeight')}
            className={inputCls}
          />
        </div>
        <div className="sm:col-span-3">
          <input
            value={shippingClass}
            onChange={(e) => setShippingClass(e.target.value)}
            placeholder={t('testerShippingClass')}
            className={inputCls}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-400"
      >
        {loading ? t('saving') : t('testerRun')}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
          {result.quote ? (
            <BreakdownView b={result.quote} primary />
          ) : (
            <p className="text-slate-500">{t('testerNoMatch')}</p>
          )}
          {result.candidates.length > 1 && (
            <div className="mt-4 space-y-2">
              <h4 className="text-xs font-semibold uppercase text-slate-500">
                {t('testerOtherCandidates')}
              </h4>
              {result.candidates.slice(1).map((c) => (
                <BreakdownView key={c.methodId} b={c} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BreakdownView({
  b,
  primary
}: {
  b: ShippingQuoteBreakdown;
  primary?: boolean;
}) {
  const t = useTranslations('admin.shipping');
  return (
    <div
      className={
        'rounded-md p-3 ' +
        (primary ? 'bg-white shadow-sm' : 'bg-white/60')
      }
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold text-slate-900">{b.methodName}</div>
          <div className="text-xs text-slate-500">
            {b.estimatedDays === 0
              ? t('sameDay')
              : t('daysValue', { days: b.estimatedDays })}{' '}
            · <code>{b.fallback}</code>
          </div>
        </div>
        <div className="text-lg font-bold text-slate-900">
          {b.total.toFixed(2)}
        </div>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
        <Row k={t('breakdownActual')} v={`${b.actualWeight} kg`} />
        <Row k={t('breakdownVolumetric')} v={`${b.volumetricWeight} kg`} />
        <Row k={t('breakdownBillable')} v={`${b.billableWeight} kg`} />
        <Row k={t('breakdownBase')} v={b.basePrice.toFixed(2)} />
        <Row k={t('breakdownWeightCost')} v={b.weightCost.toFixed(2)} />
        <Row k={t('breakdownRounding')} v={b.rounding} />
      </dl>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-slate-500">{k}</dt>
      <dd className="text-end font-medium text-slate-900">{v}</dd>
    </>
  );
}
