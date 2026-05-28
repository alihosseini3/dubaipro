'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import type { Currency, CurrencyRateDTO } from '@/types/currency';
import { BASE_CURRENCY } from '@/types/currency';

type Props = {
  initial: CurrencyRateDTO[];
};

/**
 * Admin form to edit FX rate overrides.
 *
 * The base currency (AED) is rendered as a read-only row so the admin
 * can never enter a "rate" for AED against itself. All other rows submit
 * together via a single PATCH; the API validates each entry independently.
 */
export function CurrencyRatesForm({ initial }: Props) {
  const t = useTranslations('admin.currency');
  const router = useRouter();

  const [values, setValues] = useState<Record<Currency, string>>(() => {
    const next: Record<string, string> = {};
    for (const r of initial) next[r.code] = String(r.rate);
    return next as Record<Currency, string>;
  });
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSaved(false);

    const payload: Record<string, number> = {};
    const localErrors: Record<string, string> = {};
    for (const row of initial) {
      if (row.code === BASE_CURRENCY) continue;
      const raw = values[row.code];
      const rate = Number(raw);
      if (!Number.isFinite(rate) || rate <= 0) {
        localErrors[row.code] = 'invalid_rate';
        continue;
      }
      payload[row.code] = rate;
    }
    if (Object.keys(localErrors).length) {
      setFieldErrors(localErrors);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/currency/rates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rates: payload })
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        details?: Record<string, string>;
      };
      if (!res.ok) {
        if (data.details) setFieldErrors(data.details);
        setError(data.error ? t(`error_${data.error}` as 'errorGeneric') : t('errorGeneric'));
        return;
      }
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 text-start font-semibold">
                {t('columnCurrency')}
              </th>
              <th className="px-4 py-2 text-start font-semibold">
                {t('columnRate')}
              </th>
              <th className="px-4 py-2 text-start font-semibold">
                {t('columnSource')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {initial.map((row) => {
              const isBase = row.code === BASE_CURRENCY;
              const err = fieldErrors[row.code];
              return (
                <tr key={row.code}>
                  <td className="px-4 py-3 align-top">
                    <div className="font-mono text-sm font-bold text-slate-900">
                      {row.code}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {isBase ? t('baseLabel') : t('perAed')}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    {isBase ? (
                      <div className="font-mono text-sm text-slate-400">
                        1.00000000
                      </div>
                    ) : (
                      <>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.00000001"
                          value={values[row.code] ?? ''}
                          onChange={(e) =>
                            setValues((v) => ({
                              ...v,
                              [row.code]: e.target.value
                            }))
                          }
                          className={
                            'w-44 rounded-lg border px-3 py-1.5 font-mono text-sm outline-none transition focus:ring-2 focus:ring-slate-900 focus:ring-offset-1 ' +
                            (err
                              ? 'border-red-300 focus:border-red-500'
                              : 'border-slate-200 focus:border-slate-900')
                          }
                        />
                        {err && (
                          <p className="mt-1 text-[11px] text-red-600">
                            {t(`error_${err}` as 'errorGeneric')}
                          </p>
                        )}
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    {isBase ? (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        {t('sourceBase')}
                      </span>
                    ) : row.isDefault ? (
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                        {t('sourceDefault')}
                      </span>
                    ) : (
                      <div>
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          {t('sourceDb')}
                        </span>
                        {row.updatedAt && (
                          <div className="mt-1 text-[11px] text-slate-400">
                            {new Date(row.updatedAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm font-medium text-emerald-600">
          {t('savedSuccess')}
        </p>
      )}

      <div className="flex items-center gap-2 border-t border-slate-100 pt-4">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {submitting ? t('saving') : t('save')}
        </button>
      </div>

      <p className="text-[11px] leading-relaxed text-slate-500">
        {t('footnote')}
      </p>
    </form>
  );
}
