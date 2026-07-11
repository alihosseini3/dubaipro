'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { useApiQuery, useApiMutation } from '@/hooks/use-api';

type Invoice = {
  id: string;
  periodMonths: number;
  amount: string;
  currency: string;
  status: string;
  method: string | null;
  referenceNumber: string | null;
  createdAt: string;
  plan: { code: string; nameTranslations: Record<string, string> };
  supplier: { id: string; name: string };
};

type Payload = { data: { items: Invoice[]; total: number } };

/**
 * Manual-transfer invoice queue: the admin matches the reference number
 * against the bank statement, then approve (activates the plan) or reject.
 */
export function SubscriptionInvoicesReview() {
  const t = useTranslations('admin.subscriptionInvoices');
  const locale = useLocale();
  const list = useApiQuery<Payload>('/api/admin/subscription-invoices', {
    query: { status: 'MANUAL_REVIEW', pageSize: 50 }
  });
  const review = useApiMutation<
    { id: string; action: 'approve' | 'reject'; reason?: string },
    unknown
  >((input) => `/api/admin/subscription-invoices/${input.id}/review`, 'POST');

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  async function decide(id: string, action: 'approve' | 'reject') {
    try {
      await review.mutate(
        action === 'reject' ? { id, action, reason: reason.trim() } : { id, action }
      );
      setRejectingId(null);
      setReason('');
      list.refetch();
    } catch {
      /* review.error rendered below */
    }
  }

  const items = list.data?.data.items ?? [];
  if (!list.loading && items.length === 0) return null;

  const planName = (inv: Invoice) =>
    inv.plan.nameTranslations[locale] ?? inv.plan.nameTranslations.en ?? inv.plan.code;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/40 shadow-sm">
      <h2 className="border-b border-amber-100 px-4 py-3 text-sm font-bold text-slate-900">
        {t('title', { count: items.length })}
      </h2>
      {review.error && (
        <p className="mx-4 mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {review.error.message}
        </p>
      )}
      {list.loading ? (
        <p className="px-4 py-6 text-sm text-slate-500">{t('loading')}</p>
      ) : (
        <ul className="divide-y divide-amber-100">
          {items.map((inv) => (
            <li key={inv.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">
                    {inv.supplier.name}
                    <span className="ms-2 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-bold text-orange-700">
                      {planName(inv)}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {inv.amount} {inv.currency} · {inv.periodMonths} {t('months')} ·{' '}
                    {new Date(inv.createdAt).toLocaleDateString(locale)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {t('reference')}:{' '}
                    {inv.referenceNumber ? (
                      <span className="font-mono font-semibold text-slate-700">
                        {inv.referenceNumber}
                      </span>
                    ) : (
                      <span className="text-slate-400">{t('noReference')}</span>
                    )}
                  </p>
                </div>
                <div className="flex flex-none gap-2">
                  <button
                    type="button"
                    disabled={review.loading}
                    onClick={() => decide(inv.id, 'approve')}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {t('approve')}
                  </button>
                  <button
                    type="button"
                    disabled={review.loading}
                    onClick={() =>
                      setRejectingId(rejectingId === inv.id ? null : inv.id)
                    }
                    className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                  >
                    {t('reject')}
                  </button>
                </div>
              </div>
              {rejectingId === inv.id && (
                <div className="mt-2 flex gap-2">
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={t('reasonPlaceholder')}
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={review.loading || reason.trim().length < 3}
                    onClick={() => decide(inv.id, 'reject')}
                    className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                  >
                    {t('confirmReject')}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
