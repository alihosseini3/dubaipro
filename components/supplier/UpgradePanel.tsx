'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { useApiQuery, useApiMutation } from '@/hooks/use-api';

type Plan = {
  id: string;
  code: string;
  nameTranslations: Record<string, string>;
  price: string;
  currency: string;
  intervalMonths: number;
};

type Method = {
  code: string;
  kind: 'redirect' | 'embedded' | 'manual';
  i18nKey: string;
  logo: string | null;
};

type CheckoutResult = {
  data: {
    invoiceId: string;
    kind: 'redirect' | 'embedded' | 'manual';
    redirectUrl?: string;
    manualInfo?: {
      bankName: string;
      accountHolder: string;
      reference: string;
      notes?: string;
    } | null;
  };
};

/**
 * Self-service plan upgrade. Hosted gateways redirect to the gateway;
 * manual transfers show the account details inline and collect the
 * tracking reference (admin approval activates the plan).
 */
export function UpgradePanel({ currentPlanId }: { currentPlanId: string }) {
  const t = useTranslations('supplier.subscription.upgrade');
  const tMethods = useTranslations('checkout.methods');
  const locale = useLocale();

  const plansQuery = useApiQuery<{ data: Plan[] }>('/api/plans');
  const methodsQuery = useApiQuery<{ data: Method[] }>(
    '/api/supplier/subscription/methods'
  );

  const checkout = useApiMutation<
    { planId: string; method: string; locale: string },
    CheckoutResult
  >('/api/supplier/subscription/checkout', 'POST');
  const sendReference = useApiMutation<
    { id: string; referenceNumber: string },
    unknown
  >((input) => `/api/supplier/subscription/invoices/${input.id}/reference`, 'POST');

  const [planId, setPlanId] = useState('');
  const [method, setMethod] = useState('');
  const [manual, setManual] = useState<{
    invoiceId: string;
    info: NonNullable<CheckoutResult['data']['manualInfo']>;
  } | null>(null);
  const [reference, setReference] = useState('');
  const [done, setDone] = useState(false);

  const paidPlans = (plansQuery.data?.data ?? []).filter(
    (p) => Number(p.price) > 0 && p.id !== currentPlanId
  );
  const methods = methodsQuery.data?.data ?? [];

  const planName = (p: Plan) =>
    p.nameTranslations[locale] ?? p.nameTranslations.en ?? p.code;

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (!planId || !method) return;
    try {
      const result = await checkout.mutate({ planId, method, locale });
      if (result.data.kind !== 'manual' && result.data.redirectUrl) {
        window.location.href = result.data.redirectUrl;
        return;
      }
      if (result.data.manualInfo) {
        setManual({ invoiceId: result.data.invoiceId, info: result.data.manualInfo });
      }
    } catch {
      /* checkout.error rendered below */
    }
  }

  async function handleReference(e: React.FormEvent) {
    e.preventDefault();
    if (!manual) return;
    try {
      await sendReference.mutate({
        id: manual.invoiceId,
        referenceNumber: reference.trim()
      });
      setDone(true);
    } catch {
      /* sendReference.error rendered below */
    }
  }

  if (paidPlans.length === 0 || methods.length === 0) return null;

  const field =
    'rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white';

  return (
    <div className="rounded-2xl border border-orange-200 bg-orange-50/40 p-6 dark:border-orange-900/40 dark:bg-orange-900/10">
      <h2 className="text-sm font-bold text-slate-900 dark:text-white">
        {t('title')}
      </h2>
      <p className="mt-1 text-xs text-slate-500">{t('subtitle')}</p>

      {done ? (
        <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {t('referenceSubmitted')}
        </p>
      ) : manual ? (
        <form onSubmit={handleReference} className="mt-4 space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-800">
            <p className="font-semibold text-slate-900 dark:text-white">
              {t('transferTo')}
            </p>
            <dl className="mt-2 space-y-1 text-slate-600 dark:text-slate-300">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400">{t('bank')}</dt>
                <dd>{manual.info.bankName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400">{t('accountHolder')}</dt>
                <dd>{manual.info.accountHolder}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400">{t('accountNumber')}</dt>
                <dd className="font-mono">{manual.info.reference}</dd>
              </div>
            </dl>
            {manual.info.notes && (
              <p className="mt-2 text-xs text-slate-400">{manual.info.notes}</p>
            )}
          </div>
          <div className="flex gap-2">
            <input
              required
              minLength={3}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={t('referencePlaceholder')}
              className={`flex-1 ${field}`}
            />
            <button
              type="submit"
              disabled={sendReference.loading}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {sendReference.loading ? t('sending') : t('submitReference')}
            </button>
          </div>
          {sendReference.error && (
            <p className="text-sm text-rose-600">{sendReference.error.message}</p>
          )}
        </form>
      ) : (
        <form onSubmit={handleCheckout} className="mt-4 flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="text-xs text-slate-500">{t('plan')}</span>
            <select
              required
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className={`mt-0.5 block ${field}`}
            >
              <option value="">{t('selectPlan')}</option>
              {paidPlans.map((p) => (
                <option key={p.id} value={p.id}>
                  {planName(p)} — {p.price} {p.currency} / {p.intervalMonths}m
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-slate-500">{t('method')}</span>
            <select
              required
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className={`mt-0.5 block ${field}`}
            >
              <option value="">{t('selectMethod')}</option>
              {methods.map((m) => (
                <option key={m.code} value={m.code}>
                  {tMethods(`${m.i18nKey}.label` as Parameters<typeof tMethods>[0])}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={checkout.loading || !planId || !method}
            className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {checkout.loading ? t('starting') : t('start')}
          </button>
          {checkout.error && (
            <p className="w-full text-sm text-rose-600">{checkout.error.message}</p>
          )}
        </form>
      )}
    </div>
  );
}
