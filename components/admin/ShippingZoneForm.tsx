'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import type { ShippingZoneDTO, ShippingZoneInput } from '@/types/shipping';

type Props = {
  locale: string;
  initial?: ShippingZoneDTO;
};

type Errors = Record<string, string>;

export function ShippingZoneForm({ locale, initial }: Props) {
  const t = useTranslations('admin.shipping');
  const router = useRouter();

  const [name, setName] = useState(initial?.name ?? '');
  const [countries, setCountries] = useState(
    initial ? initial.countries.join(', ') : ''
  );
  const [sortOrder, setSortOrder] = useState(
    initial ? String(initial.sortOrder) : '0'
  );
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setGeneralError(null);

    const list = countries
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const local: Errors = {};
    if (!name.trim()) local.name = 'required';
    if (list.length === 0) local.countries = 'required';
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }

    const payload: ShippingZoneInput = {
      name: name.trim(),
      countries: list,
      isActive,
      sortOrder: Number(sortOrder) || 0
    };

    setSubmitting(true);
    try {
      const url = initial
        ? `/api/admin/shipping/zones/${initial.id}`
        : '/api/admin/shipping/zones';
      const method = initial ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        details?: Errors;
      };
      if (!res.ok) {
        if (data.details) setErrors(data.details);
        setGeneralError(data.error ?? t('errorGeneric'));
        return;
      }
      router.push(`/${locale}/admin/shipping`);
      router.refresh();
    } catch {
      setGeneralError(t('errorGeneric'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!initial) return;
    if (!confirm(t('zoneDeleteConfirm'))) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/shipping/zones/${initial.id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('delete_failed');
      router.push(`/${locale}/admin/shipping`);
      router.refresh();
    } catch {
      setGeneralError(t('errorGeneric'));
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls = (err?: string) =>
    'w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-slate-900 focus:ring-offset-1 ' +
    (err
      ? 'border-red-300 focus:border-red-500'
      : 'border-slate-200 focus:border-slate-900');

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
          {t('zoneName')}
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputCls(errors.name)}
          placeholder="UAE / Iran / International"
        />
        {errors.name && (
          <p className="mt-1 text-xs text-red-600">{t(`error_${errors.name}`)}</p>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
          {t('zoneCountries')}
        </label>
        <textarea
          value={countries}
          onChange={(e) => setCountries(e.target.value)}
          rows={2}
          className={inputCls(errors.countries) + ' resize-none'}
          placeholder="AE, IR, SA  ·  *  = catch-all"
        />
        <p className="mt-1 text-[11px] text-slate-400">
          {t('zoneCountriesHint')}
        </p>
        {errors.countries && (
          <p className="mt-1 text-xs text-red-600">
            {t(`error_${errors.countries}`)}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
            {t('fieldSortOrder')}
          </label>
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className={inputCls()}
          />
        </div>
        <label className="mt-6 flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 accent-slate-900"
          />
          {t('fieldIsActive')}
        </label>
      </div>

      {generalError && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {generalError}
        </p>
      )}

      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {submitting ? t('saving') : initial ? t('save') : t('create')}
          </button>
          <button
            type="button"
            onClick={() => router.push(`/${locale}/admin/shipping`)}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            {t('cancel')}
          </button>
        </div>
        {initial && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={submitting}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            {t('delete')}
          </button>
        )}
      </div>
    </form>
  );
}
