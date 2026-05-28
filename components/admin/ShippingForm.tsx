'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import type {
  ShippingMethodDTO,
  ShippingMethodInput,
  ShippingZoneDTO
} from '@/types/shipping';

type ShippingFormProps = {
  locale: string;
  /** When provided, the form operates in edit mode. */
  initial?: ShippingMethodDTO;
  zones: ShippingZoneDTO[];
};

type Errors = Record<string, string>;

/**
 * Unified create/edit form for ShippingMethod.
 *
 * - Live field-level error clearing
 * - Server-side validation surfaced as per-field errors
 * - Redirects to the list on success and refreshes the cache
 */
export function ShippingForm({ locale, initial, zones }: ShippingFormProps) {
  const t = useTranslations('admin.shipping');
  const router = useRouter();

  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [price, setPrice] = useState<string>(
    initial ? String(initial.price) : '0'
  );
  const [estimatedDays, setEstimatedDays] = useState<string>(
    initial ? String(initial.estimatedDays) : '3'
  );
  const [sortOrder, setSortOrder] = useState<string>(
    initial ? String(initial.sortOrder) : '0'
  );
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [zoneId, setZoneId] = useState<string>(initial?.zoneId ?? '');
  const [minWeight, setMinWeight] = useState<string>(
    initial?.minWeight !== null && initial?.minWeight !== undefined
      ? String(initial.minWeight)
      : ''
  );
  const [maxWeight, setMaxWeight] = useState<string>(
    initial?.maxWeight !== null && initial?.maxWeight !== undefined
      ? String(initial.maxWeight)
      : ''
  );
  const [basePrice, setBasePrice] = useState<string>(
    initial?.basePrice !== null && initial?.basePrice !== undefined
      ? String(initial.basePrice)
      : ''
  );
  const [pricePerKg, setPricePerKg] = useState<string>(
    initial?.pricePerKg !== null && initial?.pricePerKg !== undefined
      ? String(initial.pricePerKg)
      : ''
  );
  const [volumetricFactor, setVolumetricFactor] = useState<string>(
    initial?.volumetricFactor !== null && initial?.volumetricFactor !== undefined
      ? String(initial.volumetricFactor)
      : ''
  );
  const [shippingClass, setShippingClass] = useState<string>(
    initial?.shippingClass ?? ''
  );

  const [errors, setErrors] = useState<Errors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function clearError(key: string) {
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setGeneralError(null);

    const priceNum = Number(price);
    const daysNum = Number(estimatedDays);
    const sortNum = Number(sortOrder);

    const localErrors: Errors = {};
    if (!name.trim()) localErrors.name = 'required';
    if (!Number.isFinite(priceNum) || priceNum < 0) localErrors.price = 'invalid';
    if (!Number.isInteger(daysNum) || daysNum < 0) localErrors.estimatedDays = 'invalid';
    if (Object.keys(localErrors).length) {
      setErrors(localErrors);
      return;
    }

    const payload: ShippingMethodInput = {
      name: name.trim(),
      description: description.trim() || null,
      price: priceNum,
      estimatedDays: daysNum,
      sortOrder: Number.isFinite(sortNum) ? sortNum : 0,
      isActive,
      zoneId: zoneId || null,
      minWeight: minWeight === '' ? null : Number(minWeight),
      maxWeight: maxWeight === '' ? null : Number(maxWeight),
      basePrice: basePrice === '' ? null : Number(basePrice),
      pricePerKg: pricePerKg === '' ? null : Number(pricePerKg),
      volumetricFactor:
        volumetricFactor === '' ? null : Number(volumetricFactor),
      shippingClass: shippingClass.trim() || null
    };

    setSubmitting(true);
    try {
      const url = initial
        ? `/api/admin/shipping/${initial.id}`
        : '/api/admin/shipping';
      const method = initial ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = (await res.json().catch(() => ({}))) as {
        data?: ShippingMethodDTO;
        error?: string;
        message?: string;
        details?: Errors;
      };
      if (!res.ok) {
        if (data.details) setErrors(data.details);
        setGeneralError(data.message ?? data.error ?? t('errorGeneric'));
        return;
      }
      router.push(`/${locale}/admin/shipping`);
      router.refresh();
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
            {t('fieldName')}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              clearError('name');
            }}
            className={inputClass(errors.name)}
            placeholder={t('fieldNamePlaceholder')}
          />
          {errors.name && <FieldError code={errors.name} t={t} />}
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
            {t('fieldDescription')}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className={inputClass(undefined) + ' resize-none'}
            placeholder={t('fieldDescriptionPlaceholder')}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
            {t('fieldPrice')}
          </label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => {
              setPrice(e.target.value);
              clearError('price');
            }}
            className={inputClass(errors.price)}
          />
          {errors.price && <FieldError code={errors.price} t={t} />}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
            {t('fieldEstimatedDays')}
          </label>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            value={estimatedDays}
            onChange={(e) => {
              setEstimatedDays(e.target.value);
              clearError('estimatedDays');
            }}
            className={inputClass(errors.estimatedDays)}
          />
          {errors.estimatedDays && (
            <FieldError code={errors.estimatedDays} t={t} />
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
            {t('fieldSortOrder')}
          </label>
          <input
            type="number"
            inputMode="numeric"
            step="1"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className={inputClass(undefined)}
          />
          <p className="mt-1 text-[11px] text-slate-400">
            {t('fieldSortOrderHint')}
          </p>
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
            {t('fieldZone')}
          </label>
          <select
            value={zoneId}
            onChange={(e) => setZoneId(e.target.value)}
            className={inputClass(undefined)}
          >
            <option value="">{t('zoneGlobal')}</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name} ({z.countries.join(', ')})
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-slate-400">{t('fieldZoneHint')}</p>
        </div>

        <div className="sm:col-span-2 rounded-lg border border-dashed border-slate-200 p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
            {t('ruleEngineTitle')}
          </h3>
          <p className="mb-4 text-[11px] text-slate-500">
            {t('ruleEngineHint')}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {t('fieldMinWeight')}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={minWeight}
                onChange={(e) => setMinWeight(e.target.value)}
                className={inputClass(undefined)}
                placeholder={t('emptyMeansAny')}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {t('fieldMaxWeight')}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={maxWeight}
                onChange={(e) => setMaxWeight(e.target.value)}
                className={inputClass(undefined)}
                placeholder={t('emptyMeansAny')}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {t('fieldBasePrice')}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                className={inputClass(undefined)}
                placeholder={t('flatFallbackHint')}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {t('fieldPricePerKg')}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={pricePerKg}
                onChange={(e) => setPricePerKg(e.target.value)}
                className={inputClass(undefined)}
                placeholder={t('flatFallbackHint')}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {t('fieldVolumetricFactor')}
              </label>
              <input
                type="number"
                step="1"
                min="0"
                value={volumetricFactor}
                onChange={(e) => setVolumetricFactor(e.target.value)}
                className={inputClass(undefined)}
                placeholder={t('useGlobal')}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {t('fieldShippingClass')}
              </label>
              <input
                type="text"
                value={shippingClass}
                onChange={(e) => setShippingClass(e.target.value)}
                className={inputClass(undefined)}
                placeholder="normal / fragile / heavy"
              />
            </div>
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-slate-900"
          />
          <div className="text-sm">
            <div className="font-semibold text-slate-900">
              {t('fieldIsActive')}
            </div>
            <div className="text-xs text-slate-500">
              {t('fieldIsActiveHint')}
            </div>
          </div>
        </label>
      </div>

      {generalError && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {generalError}
        </p>
      )}

      <div className="flex items-center gap-2 border-t border-slate-100 pt-4">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {submitting ? t('saving') : initial ? t('save') : t('create')}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/${locale}/admin/shipping`)}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
        >
          {t('cancel')}
        </button>
      </div>
    </form>
  );
}

function inputClass(error: string | undefined): string {
  return (
    'w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-slate-900 focus:ring-offset-1 ' +
    (error
      ? 'border-red-300 focus:border-red-500'
      : 'border-slate-200 focus:border-slate-900')
  );
}

function FieldError({
  code,
  t
}: {
  code: string;
  t: ReturnType<typeof useTranslations>;
}) {
  return <p className="mt-1 text-xs text-red-600">{t(`error_${code}`)}</p>;
}
