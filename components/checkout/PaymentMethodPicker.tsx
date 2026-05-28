'use client';

import { SmartImage } from '@/components/ui/SmartImage';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

type Method = {
  code: string;
  provider: string;
  kind: 'redirect' | 'embedded' | 'manual';
  countries: string[] | '*';
  logo: string | null;
  i18nKey: string;
};

type Props = {
  orderId: string;
  locale: string;
  country: string;
};

/**
 * Region-aware payment method picker.
 *
 * - Loads enabled methods for the user's shipping country from
 *   /api/payment/methods (server filters by env-driven catalog).
 * - On submit, calls /api/payment/create-intent with the chosen method
 *   code → backend resolves provider, creates Payment row, returns
 *   redirectUrl. Manual methods land on /checkout/<id>/manual/<paymentId>.
 */
export function PaymentMethodPicker({ orderId, locale, country }: Props) {
  const t = useTranslations('payment');
  const tm = useTranslations('checkout.methods');
  const [methods, setMethods] = useState<Method[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/payment/methods?country=${encodeURIComponent(country || '*')}`,
          { cache: 'no-store' }
        );
        const json = (await res.json()) as { data: Method[] };
        if (!alive) return;
        const list = json.data ?? [];
        setMethods(list);
        if (list[0]) setSelected(list[0].code);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [country]);

  async function handlePay() {
    if (!selected) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/payment/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, provider: selected, locale })
      });
      const payload = (await res.json().catch(() => ({}))) as {
        data?: { redirectUrl?: string };
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        throw new Error(payload.message ?? payload.error ?? `status ${res.status}`);
      }
      const url = payload.data?.redirectUrl;
      if (!url) throw new Error(t('errorNoRedirect'));
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
      setPending(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">{t('loadingMethods')}</p>;
  }
  if (methods.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">{t('noMethodsTitle')}</p>
        <p className="mt-1 text-xs text-amber-800/80">{t('noMethodsBody')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {methods.map((m) => {
          const checked = selected === m.code;
          return (
            <li key={m.code}>
              <label
                className={
                  'flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ' +
                  (checked
                    ? 'border-slate-900 bg-slate-50 shadow-sm ring-1 ring-slate-900'
                    : 'border-slate-200 bg-white hover:border-slate-300')
                }
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={m.code}
                  checked={checked}
                  onChange={() => setSelected(m.code)}
                  className="h-4 w-4 accent-slate-900"
                />
                {m.logo ? (
                  <SmartImage
                    src={m.logo}
                    alt=""
                    className="h-5 w-10 object-contain"
                    style={{ width: 40, height: 20 }}
                  />
                ) : (
                  <span className="inline-flex h-5 w-10 items-center justify-center rounded bg-slate-100 text-[10px] font-semibold text-slate-500">
                    {m.code.slice(0, 4)}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">
                      {tm(`${m.i18nKey}.label`)}
                    </span>
                    {m.kind === 'manual' && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                        {t('manualBadge')}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {tm(`${m.i18nKey}.desc`)}
                  </p>
                </div>
              </label>
            </li>
          );
        })}
      </ul>

      {error && (
        <p role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handlePay}
        disabled={pending || !selected}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {pending ? t('redirecting') : t('continueToPay')}
      </button>

      <ul className="space-y-1 text-[11px] text-slate-500">
        <li>• {t('featureEncrypted')}</li>
        <li>• {t('featureRetry')}</li>
      </ul>
    </div>
  );
}
