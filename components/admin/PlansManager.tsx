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
  maxProducts: number | null;
  maxEmployees: number | null;
  maxImagesPerProduct: number | null;
  isActive: boolean;
  sortOrder: number;
};

type PlansPayload = { data: Plan[] };

const LOCALES = ['en', 'fa', 'ar', 'ur'] as const;

type FormState = {
  code: string;
  names: Record<string, string>;
  price: string;
  currency: string;
  intervalMonths: string;
  maxProducts: string;
  maxEmployees: string;
  maxImagesPerProduct: string;
  isActive: boolean;
  sortOrder: string;
};

const EMPTY: FormState = {
  code: '',
  names: { en: '', fa: '', ar: '', ur: '' },
  price: '0',
  currency: 'USD',
  intervalMonths: '12',
  maxProducts: '',
  maxEmployees: '',
  maxImagesPerProduct: '',
  isActive: true,
  sortOrder: '0'
};

function toForm(plan: Plan): FormState {
  return {
    code: plan.code,
    names: { en: '', fa: '', ar: '', ur: '', ...plan.nameTranslations },
    price: String(plan.price),
    currency: plan.currency,
    intervalMonths: String(plan.intervalMonths),
    maxProducts: plan.maxProducts === null ? '' : String(plan.maxProducts),
    maxEmployees: plan.maxEmployees === null ? '' : String(plan.maxEmployees),
    maxImagesPerProduct:
      plan.maxImagesPerProduct === null ? '' : String(plan.maxImagesPerProduct),
    isActive: plan.isActive,
    sortOrder: String(plan.sortOrder)
  };
}

function toBody(form: FormState) {
  const intOrNull = (v: string) => (v.trim() === '' ? null : Number(v));
  return {
    code: form.code.trim().toUpperCase(),
    nameTranslations: Object.fromEntries(
      Object.entries(form.names).filter(([, v]) => v.trim() !== '')
    ),
    price: Number(form.price) || 0,
    currency: form.currency.trim().toUpperCase(),
    intervalMonths: Number(form.intervalMonths) || 12,
    maxProducts: intOrNull(form.maxProducts),
    maxEmployees: intOrNull(form.maxEmployees),
    maxImagesPerProduct: intOrNull(form.maxImagesPerProduct),
    isActive: form.isActive,
    sortOrder: Number(form.sortOrder) || 0
  };
}

/**
 * Plan CRUD (SUPER_ADMIN — the API enforces `plans.manage`; regular admins
 * see a 403 error surfaced inline).
 */
export function PlansManager() {
  const t = useTranslations('admin.plans');
  const locale = useLocale();
  const plansQuery = useApiQuery<PlansPayload>('/api/admin/plans');
  const create = useApiMutation<ReturnType<typeof toBody>, unknown>(
    '/api/admin/plans',
    'POST'
  );
  const update = useApiMutation<
    ReturnType<typeof toBody> & { id: string },
    unknown
  >((input) => `/api/admin/plans/${input.id}`, 'PATCH');

  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [notice, setNotice] = useState<string | null>(null);

  const plans = plansQuery.data?.data ?? [];
  const busy = create.loading || update.loading;
  const error = create.error ?? update.error;

  function openNew() {
    setForm(EMPTY);
    setEditingId('new');
    setNotice(null);
  }
  function openEdit(plan: Plan) {
    setForm(toForm(plan));
    setEditingId(plan.id);
    setNotice(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingId === 'new') {
        await create.mutate(toBody(form));
      } else if (editingId) {
        await update.mutate({ id: editingId, ...toBody(form) });
      }
      setNotice(t('saved'));
      setEditingId(null);
      plansQuery.refetch();
    } catch {
      /* error rendered below */
    }
  }

  const field =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none';

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openNew}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          + {t('newPlan')}
        </button>
      </div>

      {notice && <p className="text-sm text-emerald-600">{notice}</p>}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2 text-start">{t('colCode')}</th>
                <th className="px-4 py-2 text-start">{t('colName')}</th>
                <th className="px-4 py-2 text-start">{t('colPrice')}</th>
                <th className="px-4 py-2 text-start">{t('colLimits')}</th>
                <th className="px-4 py-2 text-start">{t('colStatus')}</th>
                <th className="px-4 py-2 text-start" />
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-mono text-xs font-bold">{plan.code}</td>
                  <td className="px-4 py-3">
                    {plan.nameTranslations[locale] ?? plan.nameTranslations.en}
                  </td>
                  <td className="px-4 py-3">
                    {Number(plan.price) === 0
                      ? t('free')
                      : `${plan.price} ${plan.currency} / ${plan.intervalMonths}m`}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {t('limitsCell', {
                      products: plan.maxProducts ?? '∞',
                      employees: plan.maxEmployees ?? '∞',
                      images: plan.maxImagesPerProduct ?? '∞'
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        plan.isActive
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {plan.isActive ? t('active') : t('inactive')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-end">
                    <button
                      type="button"
                      onClick={() => openEdit(plan)}
                      className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      {t('edit')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editingId !== null && (
        <form
          onSubmit={handleSave}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-sm font-bold text-slate-900">
            {editingId === 'new' ? t('newPlan') : t('editPlan')}
          </h2>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="block">
              <span className="text-xs text-slate-500">{t('colCode')}</span>
              <input
                required
                value={form.code}
                disabled={editingId !== 'new' && form.code === 'FREE'}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                className={`mt-0.5 ${field}`}
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-500">{t('price')}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                className={`mt-0.5 ${field}`}
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-500">{t('currency')}</span>
              <input
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                className={`mt-0.5 ${field}`}
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-500">{t('intervalMonths')}</span>
              <input
                type="number"
                min="1"
                max="60"
                value={form.intervalMonths}
                onChange={(e) =>
                  setForm((f) => ({ ...f, intervalMonths: e.target.value }))
                }
                className={`mt-0.5 ${field}`}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {LOCALES.map((code) => (
              <label key={code} className="block">
                <span className="text-xs uppercase text-slate-500">
                  {t('nameIn', { locale: code })}
                </span>
                <input
                  required={code === 'en'}
                  value={form.names[code] ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      names: { ...f.names, [code]: e.target.value }
                    }))
                  }
                  className={`mt-0.5 ${field}`}
                />
              </label>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="block">
              <span className="text-xs text-slate-500">{t('maxProducts')}</span>
              <input
                type="number"
                min="0"
                placeholder="∞"
                value={form.maxProducts}
                onChange={(e) => setForm((f) => ({ ...f, maxProducts: e.target.value }))}
                className={`mt-0.5 ${field}`}
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-500">{t('maxEmployees')}</span>
              <input
                type="number"
                min="0"
                placeholder="∞"
                value={form.maxEmployees}
                onChange={(e) =>
                  setForm((f) => ({ ...f, maxEmployees: e.target.value }))
                }
                className={`mt-0.5 ${field}`}
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-500">{t('maxImages')}</span>
              <input
                type="number"
                min="1"
                placeholder="∞"
                value={form.maxImagesPerProduct}
                onChange={(e) =>
                  setForm((f) => ({ ...f, maxImagesPerProduct: e.target.value }))
                }
                className={`mt-0.5 ${field}`}
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-500">{t('sortOrder')}</span>
              <input
                type="number"
                min="0"
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                className={`mt-0.5 ${field}`}
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-orange-500"
            />
            {t('activeSwitch')}
          </label>

          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error.message}
              {error.details && (
                <span className="mt-1 block text-xs">
                  {Object.entries(error.details)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(' · ')}
                </span>
              )}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {busy ? t('saving') : t('save')}
            </button>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="rounded-lg border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              {t('cancel')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
