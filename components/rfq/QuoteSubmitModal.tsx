'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { formatMoney } from '@/lib/rfq/format';

import { codeToFlag, COUNTRIES_BY_CONTINENT, type Continent } from './countries-data';

type Props = {
  open: boolean;
  onClose: () => void;
  slug: string;
  rfqQuantity: number;
  rfqUnit: string;
  rfqCurrency: string;
  rfqTargetPrice?: number | null;
  onSuccess: () => void;
  onError: (msg: string) => void;
};

type FormState = {
  price: string;
  currency: string;
  moq: string;
  leadTimeDays: string;
  deliveryMode: 'uae' | 'country';
  deliveryCountry: string; // ISO alpha-2
  paymentTerms: string;
  validUntil: string;
  message: string;
};

const CURRENCIES: { code: string; label: string }[] = [
  { code: 'USD', label: 'USD $' },
  { code: 'EUR', label: 'EUR €' },
  { code: 'AED', label: 'AED د.إ' },
  { code: 'IRR', label: 'IRR ﷼' },
];

export function QuoteSubmitModal({
  open,
  onClose,
  slug,
  rfqQuantity,
  rfqUnit,
  rfqCurrency,
  rfqTargetPrice,
  onSuccess,
  onError,
}: Props) {
  const t = useTranslations('rfqMarketplace.detail');
  const locale = useLocale();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>({
    price: '',
    currency: normalizeCurrency(rfqCurrency),
    moq: '',
    leadTimeDays: '',
    deliveryMode: 'uae',
    deliveryCountry: '',
    paymentTerms: '',
    validUntil: '',
    message: '',
  });
  const [touched, setTouched] = useState(false);
  const [continent, setContinent] = useState<Continent | 'all'>('all');
  const [countrySearch, setCountrySearch] = useState('');

  // Reset on open
  useEffect(() => {
    if (open) {
      setForm((f) => ({ ...f, currency: normalizeCurrency(rfqCurrency) }));
      setTouched(false);
      setCountrySearch('');
    }
  }, [open, rfqCurrency]);

  // Localized country names
  const regionNames = useMemo(() => {
    try {
      return new Intl.DisplayNames([locale], { type: 'region' });
    } catch {
      return new Intl.DisplayNames(['en'], { type: 'region' });
    }
  }, [locale]);

  const countryName = (code: string) => regionNames.of(code) ?? code;

  // Filtered country list based on continent + search
  const filteredCountries = useMemo(() => {
    const base =
      continent === 'all'
        ? Object.values(COUNTRIES_BY_CONTINENT).flat()
        : COUNTRIES_BY_CONTINENT[continent];
    const items = base.map((code) => ({ code, name: countryName(code) }));
    const q = countrySearch.trim().toLowerCase();
    const filtered = q
      ? items.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
      : items;
    return filtered.sort((a, b) => a.name.localeCompare(b.name, locale));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [continent, countrySearch, locale, regionNames]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  const priceNum = parseFloat(form.price) || 0;
  const total = useMemo(() => priceNum * rfqQuantity, [priceNum, rfqQuantity]);
  const priceInvalid = touched && (!form.price || priceNum <= 0);
  const canSubmit = priceNum > 0 && !submitting;

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit() {
    setTouched(true);
    if (priceNum <= 0) {
      onError(t('quoteErrPrice'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/rfq/requests/${slug}/quotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price: priceNum,
          currency: form.currency,
          moq: form.moq ? parseInt(form.moq) : undefined,
          leadTimeDays: form.leadTimeDays ? parseInt(form.leadTimeDays) : undefined,
          shippingTerms: buildShippingTerms(form, countryName, t),
          paymentTerms: form.paymentTerms || undefined,
          validUntil: form.validUntil ? new Date(form.validUntil).toISOString() : undefined,
          message: form.message || undefined,
        }),
      });
      if (res.status === 401 || res.status === 403) {
        onError(t('quoteErrAuth'));
        return;
      }
      if (!res.ok) throw new Error();
      onSuccess();
    } catch {
      onError(t('quoteErrFail'));
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/60 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
      >
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 px-6 py-5 text-white">
          <div className="absolute -end-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -start-8 -bottom-12 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 backdrop-blur">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h2 className="text-lg font-black tracking-tight">{t('quoteFormTitle')}</h2>
              </div>
              <p className="text-xs text-orange-100/90">{t('quoteFormSubtitle')}</p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-white transition hover:bg-white/25"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Pricing section */}
          <Section icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" title={t('quoteSecPricing')}>
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-8">
                <Label required>{t('quotePrice')}</Label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.price}
                    onChange={(e) => set('price', e.target.value)}
                    onBlur={() => setTouched(true)}
                    className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-base font-bold text-slate-900 outline-none transition focus:ring-4 ${
                      priceInvalid
                        ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
                        : 'border-slate-200 focus:border-orange-400 focus:ring-orange-100'
                    }`}
                  />
                  <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                    / {rfqUnit}
                  </span>
                </div>
                {priceInvalid && <p className="mt-1 text-[11px] font-semibold text-red-500">{t('quoteErrPrice')}</p>}
                {rfqTargetPrice && !priceInvalid && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    {t('quoteBuyerWants', { price: formatMoney(rfqTargetPrice, rfqCurrency) })}
                  </p>
                )}
              </div>
              <div className="col-span-4">
                <Label>{t('quoteCurrency')}</Label>
                <select
                  value={form.currency}
                  onChange={(e) => set('currency', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base font-bold text-slate-900 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* MOQ */}
            <div className="mt-3">
              <Label>{t('quoteMoq')}</Label>
              <input
                type="number"
                min="1"
                placeholder={String(rfqQuantity)}
                value={form.moq}
                onChange={(e) => set('moq', e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
              />
              <p className="mt-1 text-[11px] text-slate-500">{t('quoteMoqHint', { qty: rfqQuantity, unit: rfqUnit })}</p>
            </div>

            {/* Total preview */}
            {priceNum > 0 && (
              <div className="mt-4 flex items-center justify-between rounded-xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 px-4 py-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-orange-600">{t('quoteTotal')}</span>
                <span className="text-xl font-black text-orange-700">{formatMoney(total, form.currency)}</span>
              </div>
            )}
          </Section>

          {/* Delivery section */}
          <Section icon="M5 8h14M5 8a2 2 0 110-4h.582m13.836 0H19a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" title={t('quoteSecDelivery')}>
            {/* Lead time */}
            <div className="mb-3">
              <Label>{t('quoteLeadTime')}</Label>
              <div className="relative max-w-[200px]">
                <input
                  type="number"
                  min="1"
                  placeholder="14"
                  value={form.leadTimeDays}
                  onChange={(e) => set('leadTimeDays', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
                />
                <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                  {t('quoteLeadTimeUnit')}
                </span>
              </div>
            </div>

            {/* Delivery mode */}
            <div>
              <Label>{t('quoteDeliveryMode')}</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <DeliveryOption
                  active={form.deliveryMode === 'uae'}
                  onClick={() => set('deliveryMode', 'uae')}
                  flag={codeToFlag('AE')}
                  title={t('quoteDeliveryUae')}
                  hint={t('quoteDeliveryUaeHint')}
                />
                <DeliveryOption
                  active={form.deliveryMode === 'country'}
                  onClick={() => set('deliveryMode', 'country')}
                  flag={'🌍'}
                  title={t('quoteDeliveryCountry')}
                  hint={t('quoteDeliveryCountryHint')}
                />
              </div>
            </div>

            {/* Country picker */}
            {form.deliveryMode === 'country' && (
              <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {/* Search */}
                <div className="border-b border-slate-100 p-2">
                  <div className="relative">
                    <svg className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      autoFocus
                      placeholder={t('quoteSearchCountry')}
                      value={countrySearch}
                      onChange={(e) => setCountrySearch(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 ps-9 pe-3 py-2 text-sm text-slate-800 outline-none transition focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-100"
                    />
                  </div>
                </div>

                {/* Continent tabs */}
                <div className="flex gap-1 overflow-x-auto border-b border-slate-100 p-2">
                  {(['all', 'asia', 'europe', 'africa', 'americas', 'oceania'] as const).map((c) => {
                    const labelKey =
                      c === 'all' ? 'quoteContinentAll' :
                      c === 'asia' ? 'quoteContinentAsia' :
                      c === 'europe' ? 'quoteContinentEurope' :
                      c === 'africa' ? 'quoteContinentAfrica' :
                      c === 'americas' ? 'quoteContinentAmericas' : 'quoteContinentOceania';
                    const isActive = continent === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setContinent(c)}
                        className={`shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition ${
                          isActive
                            ? 'bg-orange-500 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {t(labelKey)}
                      </button>
                    );
                  })}
                </div>

                {/* Country list */}
                <div className="max-h-56 overflow-y-auto">
                  {filteredCountries.length === 0 ? (
                    <p className="px-4 py-8 text-center text-xs text-slate-400">{t('quoteNoCountry')}</p>
                  ) : (
                    <ul className="divide-y divide-slate-50">
                      {filteredCountries.map(({ code, name }) => {
                        const selected = form.deliveryCountry === code;
                        return (
                          <li key={code}>
                            <button
                              type="button"
                              onClick={() => set('deliveryCountry', code)}
                              className={`flex w-full items-center gap-3 px-4 py-2.5 text-start transition ${
                                selected ? 'bg-orange-50' : 'hover:bg-slate-50'
                              }`}
                            >
                              <span className="text-lg leading-none">{codeToFlag(code)}</span>
                              <span className={`flex-1 text-sm ${selected ? 'font-bold text-orange-700' : 'text-slate-700'}`}>
                                {name}
                              </span>
                              <span className="text-[10px] font-mono font-semibold text-slate-400">{code}</span>
                              {selected && (
                                <svg className="h-4 w-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </Section>

          {/* Terms */}
          <Section icon="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" title={t('quoteSecTerms')}>
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-7">
                <Label>{t('quotePaymentTerms')}</Label>
                <input
                  type="text"
                  placeholder={t('quotePaymentPlaceholder')}
                  value={form.paymentTerms}
                  onChange={(e) => set('paymentTerms', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
                />
              </div>
              <div className="col-span-5">
                <Label>{t('quoteValidUntil')}</Label>
                <input
                  type="date"
                  value={form.validUntil}
                  onChange={(e) => set('validUntil', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
                />
              </div>
            </div>
          </Section>

          {/* Message */}
          <Section icon="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" title={t('quoteSecMessage')}>
            <textarea
              rows={4}
              placeholder={t('quoteMessagePlaceholder')}
              value={form.message}
              onChange={(e) => set('message', e.target.value)}
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-slate-800 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
            />
          </Section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-200 disabled:opacity-50"
          >
            {t('quoteCancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-200 transition hover:from-orange-600 hover:to-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
            {t('quoteSubmit')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  const t = useTranslations('rfqMarketplace.detail');
  return (
    <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
      {children}
      {required && (
        <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[9px] font-bold text-red-600">
          {t('quoteRequired')}
        </span>
      )}
    </label>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <section className="mb-5 last:mb-0">
      <div className="mb-2.5 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
          </svg>
        </div>
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">{title}</h3>
        <div className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent" />
      </div>
      {children}
    </section>
  );
}

function DeliveryOption({
  active,
  onClick,
  flag,
  title,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  flag: string;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex items-start gap-3 rounded-xl border-2 p-3 text-start transition ${
        active
          ? 'border-orange-400 bg-orange-50 shadow-sm'
          : 'border-slate-200 bg-white hover:border-orange-200 hover:bg-orange-50/40'
      }`}
    >
      <span className="text-2xl leading-none">{flag}</span>
      <div className="flex-1">
        <div className="flex items-center gap-1.5">
          <span className={`text-sm font-bold ${active ? 'text-orange-700' : 'text-slate-800'}`}>{title}</span>
          {active && (
            <svg className="h-4 w-4 text-orange-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm-1.4 14.4l-4-4 1.4-1.4 2.6 2.6 5.6-5.6 1.4 1.4-7 7z" />
            </svg>
          )}
        </div>
        <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{hint}</p>
      </div>
    </button>
  );
}

const ALLOWED_CURRENCIES = new Set(['USD', 'EUR', 'AED', 'IRR']);

function normalizeCurrency(input: string | undefined | null): string {
  const c = (input ?? 'USD').toUpperCase();
  return ALLOWED_CURRENCIES.has(c) ? c : 'USD';
}

function buildShippingTerms(
  form: FormState,
  countryName: (code: string) => string,
  t: (key: string) => string,
): string | undefined {
  if (form.deliveryMode === 'uae') return t('quoteDeliveryUae');
  if (form.deliveryMode === 'country' && form.deliveryCountry) {
    return `${t('quoteDeliveryCountry')}: ${countryName(form.deliveryCountry)} (${form.deliveryCountry})`;
  }
  return undefined;
}
