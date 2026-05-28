'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import type { AddressDTO, AddressInput } from '@/types/address';

type AddressStepClientProps = {
  orderId: string;
  locale: string;
  initialAddresses: AddressDTO[];
  initialSelectedId: string | null;
};

type FormState = AddressInput;

const EMPTY_FORM: FormState = {
  fullName: '',
  phone: '',
  country: '',
  city: '',
  addressLine: '',
  postalCode: ''
};

/**
 * Step 1 of checkout — select an existing address or create a new one.
 *
 * Uses POST /api/address to create, then POST /api/shipping/select to
 * attach the chosen address to the order (with a placeholder shipping
 * method chosen on the next step — server only attaches address+shipping
 * atomically, so we defer the API call until step 2 and just redirect
 * there with the selection in a temporary URL param).
 *
 * To keep the server as the source of truth we store the selected
 * addressId in the URL when navigating to /shipping.
 */
export function AddressStepClient({
  orderId,
  locale,
  initialAddresses,
  initialSelectedId
}: AddressStepClientProps) {
  const t = useTranslations('address');
  const tc = useTranslations('checkout');
  const router = useRouter();

  const [addresses, setAddresses] = useState(initialAddresses);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId ?? addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? null
  );
  const [showForm, setShowForm] = useState(addresses.length === 0);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key as string]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[key as string];
        return copy;
      });
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});
    setGeneralError(null);
    try {
      const res = await fetch('/api/address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const payload = (await res.json().catch(() => ({}))) as {
        data?: AddressDTO;
        error?: string;
        details?: Record<string, string>;
        message?: string;
      };
      if (!res.ok || !payload.data) {
        if (payload.details) setErrors(payload.details);
        setGeneralError(payload.message ?? payload.error ?? t('errorGeneric'));
        return;
      }
      setAddresses((prev) => [payload.data!, ...prev]);
      setSelectedId(payload.data.id);
      setShowForm(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setSubmitting(false);
    }
  }

  function handleContinue() {
    if (!selectedId) {
      setGeneralError(t('errorSelectRequired'));
      return;
    }
    const qs = new URLSearchParams({ addressId: selectedId });
    router.push(`/${locale}/checkout/${orderId}/shipping?${qs.toString()}`);
  }

  return (
    <div className="space-y-6">
      {addresses.length > 0 && (
        <ul className="space-y-3">
          {addresses.map((addr) => {
            const checked = selectedId === addr.id;
            return (
              <li key={addr.id}>
                <label
                  className={
                    'flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ' +
                    (checked
                      ? 'border-slate-900 bg-slate-50 shadow-sm ring-1 ring-slate-900'
                      : 'border-slate-200 bg-white hover:border-slate-300')
                  }
                >
                  <input
                    type="radio"
                    name="address"
                    value={addr.id}
                    checked={checked}
                    onChange={() => setSelectedId(addr.id)}
                    className="mt-1 h-4 w-4 accent-slate-900"
                  />
                  <div className="flex-1 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{addr.fullName}</span>
                      {addr.isDefault && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                          {t('default')}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-slate-600">{addr.phone}</p>
                    <p className="mt-1 text-slate-700">{addr.addressLine}</p>
                    <p className="text-slate-500">
                      {addr.city}, {addr.country} · {addr.postalCode}
                    </p>
                  </div>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {!showForm && addresses.length > 0 && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
        >
          <span className="text-lg leading-none">+</span>
          {t('addNew')}
        </button>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          noValidate
        >
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t('newTitle')}
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label={t('fullName')}
              name="name"
              autoComplete="name"
              value={form.fullName}
              onChange={(v) => update('fullName', v)}
              error={errors.fullName}
              t={t}
            />
            <Field
              label={t('phone')}
              name="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={(v) => update('phone', v)}
              error={errors.phone}
              t={t}
              inputMode="tel"
            />
            <Field
              label={t('country')}
              name="country"
              autoComplete="country-name"
              value={form.country}
              onChange={(v) => update('country', v)}
              error={errors.country}
              t={t}
            />
            <Field
              label={t('city')}
              name="address-level2"
              autoComplete="address-level2"
              value={form.city}
              onChange={(v) => update('city', v)}
              error={errors.city}
              t={t}
            />
            <Field
              label={t('postalCode')}
              name="postal-code"
              autoComplete="postal-code"
              value={form.postalCode}
              onChange={(v) => update('postalCode', v)}
              error={errors.postalCode}
              t={t}
            />
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                {t('addressLine')}
              </label>
              <textarea
                rows={2}
                autoComplete="street-address"
                value={form.addressLine}
                onChange={(e) => update('addressLine', e.target.value)}
                className={
                  'w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-slate-900 focus:ring-offset-1 ' +
                  (errors.addressLine
                    ? 'border-red-300 focus:border-red-500'
                    : 'border-slate-200 focus:border-slate-900')
                }
              />
              {errors.addressLine && (
                <p className="mt-1 text-xs text-red-600">{t(`error_${errors.addressLine}`)}</p>
              )}
            </div>
          </div>

          {generalError && (
            <p role="alert" className="text-sm font-medium text-red-600">
              {generalError}
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {submitting ? t('saving') : t('save')}
            </button>
            {addresses.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setForm(EMPTY_FORM);
                  setErrors({});
                }}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                {t('cancel')}
              </button>
            )}
          </div>
        </form>
      )}

      {!showForm && (
        <div className="flex items-center justify-end border-t border-slate-100 pt-5">
          <button
            type="button"
            onClick={handleContinue}
            disabled={!selectedId}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {tc('continueToShipping')}
            <ArrowIcon />
          </button>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  name,
  autoComplete,
  value,
  onChange,
  error,
  t,
  inputMode
}: {
  label: string;
  name: string;
  autoComplete: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  t: ReturnType<typeof useTranslations>;
  inputMode?: 'tel' | 'text';
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-700">{label}</label>
      <input
        type="text"
        name={name}
        autoComplete={autoComplete}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={
          'w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-slate-900 focus:ring-offset-1 ' +
          (error
            ? 'border-red-300 focus:border-red-500'
            : 'border-slate-200 focus:border-slate-900')
        }
      />
      {error && <p className="mt-1 text-xs text-red-600">{t(`error_${error}`)}</p>}
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
