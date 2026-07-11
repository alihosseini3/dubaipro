'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { useApiQuery, useApiMutation } from '@/hooks/use-api';

type Plan = {
  id: string;
  code: string;
  nameTranslations: Record<string, string>;
  intervalMonths: number;
};

type Row = {
  supplierId: string;
  supplierName: string;
  subscription: {
    id: string;
    status: string;
    currentPeriodEnd: string | null;
    plan: Plan;
  } | null;
};

type ListPayload = { data: { items: Row[]; total: number } };
type PlansPayload = { data: Plan[] };

const PAGE_SIZE = 20;

/** Admin subscription overview: search suppliers, assign/change plans. */
export function SubscriptionsManager() {
  const t = useTranslations('admin.subscriptions');
  const locale = useLocale();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<Record<string, { planId: string; months: string }>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const list = useApiQuery<ListPayload>('/api/admin/subscriptions', {
    query: { page, pageSize: PAGE_SIZE, ...(search ? { q: search } : {}) }
  });
  const plansQuery = useApiQuery<PlansPayload>('/api/admin/plans');
  const assign = useApiMutation<
    { supplierId: string; planId: string; periodMonths?: number },
    unknown
  >('/api/admin/subscriptions/assign', 'POST');

  const plans = plansQuery.data?.data ?? [];
  const items = list.data?.data.items ?? [];
  const total = list.data?.data.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const planName = (plan: Plan) =>
    plan.nameTranslations[locale] ?? plan.nameTranslations.en ?? plan.code;

  async function handleAssign(supplierId: string) {
    const sel = pending[supplierId];
    if (!sel?.planId) return;
    setNotice(null);
    try {
      await assign.mutate({
        supplierId,
        planId: sel.planId,
        ...(sel.months ? { periodMonths: Number(sel.months) } : {})
      });
      setNotice(t('assigned'));
      list.refetch();
    } catch {
      /* assign.error rendered below */
    }
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch(q.trim());
        }}
        className="flex gap-2"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="h-10 w-72 rounded-lg border border-slate-300 px-3 text-sm focus:border-orange-500 focus:outline-none"
        />
        <button
          type="submit"
          className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
        >
          {t('search')}
        </button>
      </form>

      {notice && <p className="text-sm text-emerald-600">{notice}</p>}
      {assign.error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {assign.error.message}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {list.loading ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">{t('loading')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2 text-start">{t('colSupplier')}</th>
                  <th className="px-4 py-2 text-start">{t('colPlan')}</th>
                  <th className="px-4 py-2 text-start">{t('colExpiry')}</th>
                  <th className="px-4 py-2 text-start">{t('colAssign')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.supplierId} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {row.supplierName}
                    </td>
                    <td className="px-4 py-3">
                      {row.subscription ? (
                        <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-bold text-orange-700">
                          {planName(row.subscription.plan)}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {row.subscription?.currentPeriodEnd
                        ? new Date(row.subscription.currentPeriodEnd).toLocaleDateString(
                            locale
                          )
                        : t('never')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={pending[row.supplierId]?.planId ?? ''}
                          onChange={(e) =>
                            setPending((prev) => ({
                              ...prev,
                              [row.supplierId]: {
                                planId: e.target.value,
                                months: prev[row.supplierId]?.months ?? ''
                              }
                            }))
                          }
                          className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                        >
                          <option value="">{t('selectPlan')}</option>
                          {plans.map((plan) => (
                            <option key={plan.id} value={plan.id}>
                              {planName(plan)}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min={1}
                          max={60}
                          placeholder={t('months')}
                          value={pending[row.supplierId]?.months ?? ''}
                          onChange={(e) =>
                            setPending((prev) => ({
                              ...prev,
                              [row.supplierId]: {
                                planId: prev[row.supplierId]?.planId ?? '',
                                months: e.target.value
                              }
                            }))
                          }
                          className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-xs"
                        />
                        <button
                          type="button"
                          disabled={assign.loading || !pending[row.supplierId]?.planId}
                          onClick={() => handleAssign(row.supplierId)}
                          className="rounded-lg bg-orange-500 px-3 py-1 text-xs font-bold text-white hover:bg-orange-600 disabled:opacity-40"
                        >
                          {t('assign')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40"
            >
              {t('prev')}
            </button>
            <span className="text-slate-500">{t('pageOf', { page, pages })}</span>
            <button
              type="button"
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40"
            >
              {t('next')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
