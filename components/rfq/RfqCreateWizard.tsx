'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Step = 1 | 2 | 3 | 4;

export type WizardLabels = {
  step1: string; step2: string; step3: string; step4: string;
  eyebrow: string; h1: string; h2: string; h3: string; h4: string;
  rfqTitle: string; description: string; category: string; productRef: string;
  quantity: string; unit: string; targetPrice: string; currency: string;
  destination: string; urgency: string; visibility: string; sourcingNotes: string;
  back: string; continue: string; submit: string; submitting: string;
  placeholderTitle: string; placeholderDescription: string; placeholderCategory: string;
  placeholderProductRef: string; placeholderQuantity: string; placeholderPrice: string;
  placeholderSourcingNotes: string; placeholderCountry: string;
  visPublic: string; visInvited: string; visPrivate: string;
  reviewNote: string;
  errTitle: string; errDescription: string; errQuantity: string; errDestination: string;
  reviewLabelTitle: string; reviewLabelQty: string; reviewLabelPrice: string;
  reviewLabelDest: string; reviewLabelUrgency: string; reviewLabelVis: string;
  urgencyStandard: string; urgencyUrgent: string; urgencyAsap: string;
  whatsapp: string; email: string;
  placeholderWhatsapp: string; placeholderEmail: string;
  whatsappNote: string; emailNote: string;
  errWhatsapp: string;
  reviewLabelWhatsapp: string; reviewLabelEmail: string;
  contactHeading: string;
};

const UNITS = ['pcs', 'kg', 'ton', 'set', 'box', 'carton', 'pair', 'm', 'm²', 'liter', 'pack'];
const CURRENCIES = ['USD', 'EUR', 'AED', 'IRR'];
const COUNTRY_CODES = [
  'AF', 'AX', 'AL', 'DZ', 'AS', 'AD', 'AO', 'AI', 'AQ', 'AG', 'AR', 'AM', 'AW', 'AU', 'AT', 'AZ',
  'BS', 'BH', 'BD', 'BB', 'BY', 'BE', 'BZ', 'BJ', 'BM', 'BT', 'BO', 'BA', 'BW', 'BR', 'IO', 'BN',
  'BG', 'BF', 'BI', 'CV', 'KH', 'CM', 'CA', 'KY', 'CF', 'TD', 'CL', 'CN', 'CX', 'CC', 'CO', 'KM',
  'CG', 'CD', 'CK', 'CR', 'CI', 'HR', 'CU', 'CW', 'CY', 'CZ', 'DK', 'DJ', 'DM', 'DO', 'EC', 'EG',
  'SV', 'GQ', 'ER', 'EE', 'SZ', 'ET', 'FK', 'FO', 'FJ', 'FI', 'FR', 'GF', 'PF', 'TF', 'GA', 'GM',
  'GE', 'DE', 'GH', 'GI', 'GR', 'GL', 'GD', 'GP', 'GU', 'GT', 'GG', 'GN', 'GW', 'GY', 'HT', 'HN',
  'HK', 'HU', 'IS', 'IN', 'ID', 'IR', 'IQ', 'IE', 'IM', 'IL', 'IT', 'JM', 'JP', 'JE', 'JO', 'KZ',
  'KE', 'KI', 'KR', 'KW', 'KG', 'LA', 'LV', 'LB', 'LS', 'LR', 'LY', 'LI', 'LT', 'LU', 'MO',
  'MG', 'MW', 'MY', 'MV', 'ML', 'MT', 'MH', 'MQ', 'MR', 'MU', 'YT', 'MX', 'FM', 'MD', 'MC', 'MN',
  'ME', 'MS', 'MA', 'MZ', 'MM', 'NA', 'NR', 'NP', 'NL', 'NC', 'NZ', 'NI', 'NE', 'NG', 'NU', 'NF',
  'MK', 'MP', 'NO', 'OM', 'PK', 'PW', 'PS', 'PA', 'PG', 'PY', 'PE', 'PH', 'PL', 'PT', 'PR', 'QA',
  'RE', 'RO', 'RU', 'RW', 'BL', 'SH', 'KN', 'LC', 'MF', 'PM', 'VC', 'WS', 'SM', 'ST', 'SA', 'SN',
  'RS', 'SC', 'SL', 'SG', 'SX', 'SK', 'SI', 'SB', 'SO', 'ZA', 'GS', 'SS', 'ES', 'LK', 'SD', 'SR',
  'SE', 'CH', 'SY', 'TW', 'TJ', 'TZ', 'TH', 'TL', 'TG', 'TK', 'TO', 'TT', 'TN', 'TR', 'TM', 'TC',
  'TV', 'UG', 'UA', 'AE', 'GB', 'US', 'UM', 'UY', 'UZ', 'VU', 'VA', 'VE', 'VN', 'VG', 'VI', 'WF',
  'EH', 'YE', 'ZM', 'ZW',
] as const;

type FormState = {
  title: string;
  description: string;
  categoryId: string;
  productRef: string;
  quantity: string;
  unit: string;
  targetPrice: string;
  currency: string;
  shippingCountry: string;
  urgency: 'STANDARD' | 'URGENT' | 'ASAP';
  visibility: 'PUBLIC' | 'INVITED_ONLY' | 'PRIVATE';
  sourcingNotes: string;
  whatsapp: string;
  email: string;
};

const INIT: FormState = {
  title: '', description: '', categoryId: '', productRef: '',
  quantity: '', unit: 'pcs', targetPrice: '', currency: 'USD',
  shippingCountry: '', urgency: 'STANDARD', visibility: 'PUBLIC',
  sourcingNotes: '', whatsapp: '+', email: '',
};

type Category = { id: string; name: string };

export function RfqCreateWizard({
  locale,
  categories,
  labels,
}: {
  locale: string;
  categories: Category[];
  labels: WizardLabels;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const countryNames = new Intl.DisplayNames([locale], { type: 'region' });
  const STEPS = [
    { id: 1, label: labels.step1 },
    { id: 2, label: labels.step2 },
    { id: 3, label: labels.step3 },
    { id: 4, label: labels.step4 },
  ];
  const [form, setForm] = useState<FormState>(INIT);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patch(key: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function getCountryLabel(code: string) {
    return countryNames.of(code) ?? code;
  }

  function validate(): string | null {
    if (step === 1) {
      if (!form.title.trim()) return labels.errTitle;
      if (!form.description.trim()) return labels.errDescription;
    }
    if (step === 2) {
      if (!form.quantity || Number(form.quantity) < 1) return labels.errQuantity;
    }
    if (step === 3) {
      if (!form.shippingCountry) return labels.errDestination;
      const wa = form.whatsapp.trim();
      if (!wa || wa === '+') return labels.errWhatsapp;
      if (!/^\+\d{7,15}$/.test(wa.replace(/[\s\-().]/g, ''))) return labels.errWhatsapp;
    }
    return null;
  }

  function next() {
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);
    setStep((s) => (s < 4 ? ((s + 1) as Step) : s));
  }

  async function submit() {
    const err = validate();
    if (err) { setError(err); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/rfq/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim(),
          categoryId: form.categoryId || undefined,
          productRef: form.productRef || undefined,
          quantity: Number(form.quantity),
          unit: form.unit,
          targetPrice: form.targetPrice ? Number(form.targetPrice) : undefined,
          currency: form.currency,
          shippingCountry: form.shippingCountry,
          urgency: form.urgency,
          visibility: form.visibility,
          sourcingNotes: form.sourcingNotes || undefined,
          whatsapp: form.whatsapp.trim(),
          email: form.email.trim() || undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Submit failed');
      router.push(`/${locale}/rfq/${j.data.slug}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submission failed.');
      setSubmitting(false);
    }
  }

  const pct = Math.round(((step - 1) / 3) * 100);

  return (
    <div className="mx-auto max-w-2xl">

      {/* ── Progress bar ─────────────────────────────────────────── */}
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-500">
          {STEPS[step - 1].label}
        </span>
        <span className="text-[11px] font-semibold text-orange-500">{pct}%</span>
      </div>
      <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-600 transition-all duration-500"
          style={{ width: `${pct + 25}%` }}
        />
      </div>

      {/* ── Step pills ───────────────────────────────────────────── */}
      <div className="mb-8 flex items-center gap-0">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex flex-1 items-center">
            <button
              type="button"
              onClick={() => step > s.id && setStep(s.id as Step)}
              className="flex flex-col items-center gap-1.5"
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold shadow-sm transition-all duration-300 ${
                  step > s.id
                    ? 'bg-emerald-500 text-white shadow-emerald-200'
                    : step === s.id
                    ? 'bg-orange-500 text-white shadow-orange-200 ring-4 ring-orange-100'
                    : 'bg-white text-slate-400 ring-1 ring-slate-200'
                }`}
              >
                {step > s.id ? (
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 15l-4.121-4.121a1 1 0 011.414-1.414L8.414 12.172l7.879-7.879a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                ) : s.id}
              </span>
              <span className={`hidden text-[10px] font-semibold sm:block ${step === s.id ? 'text-orange-600' : 'text-slate-400'}`}>
                {s.label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <div className="mx-2 flex-1">
                <div className={`h-0.5 w-full rounded-full transition-all duration-500 ${step > s.id ? 'bg-emerald-400' : 'bg-slate-200'}`} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Form card ────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">

        {/* Card header */}
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
          <h2 className="text-base font-bold text-slate-900">
            {step === 1 && labels.h1}
            {step === 2 && labels.h2}
            {step === 3 && labels.h3}
            {step === 4 && labels.h4}
          </h2>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/></svg>
              <p className="text-sm font-medium text-red-700">{error}</p>
            </div>
          )}

          {/* ── Step 1: Product Info ── */}
          {step === 1 && (
            <div className="space-y-5">
              <Field label={`${labels.rfqTitle} *`}>
                <input
                  value={form.title}
                  onChange={(e) => patch('title', e.target.value)}
                  placeholder={labels.placeholderTitle}
                  className={INPUT_CLS}
                />
              </Field>
              <Field label={`${labels.description} *`}>
                <textarea
                  value={form.description}
                  onChange={(e) => patch('description', e.target.value)}
                  rows={4}
                  placeholder={labels.placeholderDescription}
                  className={`${INPUT_CLS} resize-y`}
                />
              </Field>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field label={labels.category}>
                  <select value={form.categoryId} onChange={(e) => patch('categoryId', e.target.value)} className={INPUT_CLS}>
                    <option value="">{labels.placeholderCategory}</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label={labels.productRef}>
                  <input
                    value={form.productRef}
                    onChange={(e) => patch('productRef', e.target.value)}
                    placeholder={labels.placeholderProductRef}
                    className={INPUT_CLS}
                  />
                </Field>
              </div>
            </div>
          )}

          {/* ── Step 2: Quantity & Budget ── */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <Field label={`${labels.quantity} *`}>
                  <input
                    type="number"
                    min={1}
                    value={form.quantity}
                    onChange={(e) => patch('quantity', e.target.value)}
                    placeholder={labels.placeholderQuantity}
                    className={INPUT_CLS}
                  />
                </Field>
                <Field label={`${labels.unit} *`}>
                  <select value={form.unit} onChange={(e) => patch('unit', e.target.value)} className={INPUT_CLS}>
                    {UNITS.map((u) => <option key={u}>{u}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label={labels.targetPrice}>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.targetPrice}
                    onChange={(e) => patch('targetPrice', e.target.value)}
                    placeholder={labels.placeholderPrice}
                    className={INPUT_CLS}
                  />
                </Field>
                <Field label={labels.currency}>
                  <select value={form.currency} onChange={(e) => patch('currency', e.target.value)} className={INPUT_CLS}>
                    {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </Field>
              </div>
              <Field label={labels.sourcingNotes}>
                <textarea
                  value={form.sourcingNotes}
                  onChange={(e) => patch('sourcingNotes', e.target.value)}
                  rows={3}
                  placeholder={labels.placeholderSourcingNotes}
                  className={`${INPUT_CLS} resize-y`}
                />
              </Field>
            </div>
          )}

          {/* ── Step 3: Shipping + Contact ── */}
          {step === 3 && (
            <div className="space-y-6">
              {/* Shipping */}
              <div className="space-y-4">
                <Field label={`${labels.destination} *`}>
                  <select value={form.shippingCountry} onChange={(e) => patch('shippingCountry', e.target.value)} className={INPUT_CLS}>
                    <option value="">{labels.placeholderCountry}</option>
                    {COUNTRY_CODES.map((code) => (
                      <option key={code} value={code}>{getCountryLabel(code)}</option>
                    ))}
                  </select>
                </Field>
                <Field label={labels.urgency}>
                  <div className="flex gap-3">
                    {([
                      ['STANDARD', labels.urgencyStandard],
                      ['URGENT', labels.urgencyUrgent],
                      ['ASAP', labels.urgencyAsap],
                    ] as const).map(([u, uLabel]) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => patch('urgency', u)}
                        className={`flex-1 rounded-xl border py-2.5 text-xs font-bold uppercase tracking-wide transition ${
                          form.urgency === u
                            ? 'border-orange-400 bg-orange-50 text-orange-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-orange-200 hover:bg-orange-50/50'
                        }`}
                      >
                        {uLabel}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label={labels.visibility}>
                  <div className="space-y-2">
                    {([
                      ['PUBLIC', 'PUBLIC', labels.visPublic],
                      ['INVITED_ONLY', 'INVITED', labels.visInvited],
                      ['PRIVATE', 'PRIVATE', labels.visPrivate],
                    ] as const).map(([val, badge, desc]) => (
                      <label
                        key={val}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition ${
                          form.visibility === val
                            ? 'border-orange-400 bg-orange-50'
                            : 'border-slate-200 bg-white hover:border-orange-200'
                        }`}
                      >
                        <input
                          type="radio"
                          name="visibility"
                          value={val}
                          checked={form.visibility === val}
                          onChange={() => patch('visibility', val)}
                          className="accent-orange-500"
                        />
                        <div className="flex flex-1 items-center justify-between">
                          <p className="text-sm font-medium text-slate-800">{desc}</p>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{badge}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </Field>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1">
                  <svg className="h-3.5 w-3.5 text-emerald-600" viewBox="0 0 20 20" fill="currentColor"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/></svg>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">{labels.contactHeading}</span>
                </div>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              {/* Contact */}
              <div className="space-y-4">
                <Field label={`${labels.whatsapp} *`} note={labels.whatsappNote} noteColor="text-emerald-600">
                  <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white transition focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-100 hover:border-slate-300">
                    <div className="flex shrink-0 items-center gap-1.5 border-e border-slate-200 bg-slate-50 px-3">
                      <svg className="h-4 w-4 text-emerald-500" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      <span className="text-sm font-bold text-slate-700">+</span>
                    </div>
                    <input
                      type="tel"
                      value={form.whatsapp.replace(/^\+/, '')}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/[^\d\s\-().]/g, '');
                        patch('whatsapp', '+' + digits);
                      }}
                      placeholder="971 50 123 4567"
                      className="flex-1 bg-transparent px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
                      dir="ltr"
                      inputMode="tel"
                    />
                  </div>
                </Field>
                <Field label={labels.email} note={labels.emailNote} noteColor="text-slate-400">
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3">
                      <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                    </div>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => patch('email', e.target.value)}
                      placeholder={labels.placeholderEmail}
                      className={`${INPUT_CLS} ps-9`}
                      dir="ltr"
                    />
                  </div>
                </Field>
              </div>
            </div>
          )}

          {/* ── Step 4: Review ── */}
          {step === 4 && (
            <div className="space-y-3">
              <ReviewRow label={labels.reviewLabelTitle} value={form.title} />
              <ReviewRow label={labels.reviewLabelQty} value={`${form.quantity} ${form.unit}`} />
              {form.targetPrice && (
                <ReviewRow label={labels.reviewLabelPrice} value={`${form.targetPrice} ${form.currency}`} />
              )}
              <ReviewRow label={labels.reviewLabelDest} value={getCountryLabel(form.shippingCountry)} />
              <ReviewRow label={labels.reviewLabelUrgency} value={form.urgency} />
              <ReviewRow label={labels.reviewLabelVis} value={form.visibility} />
              <ReviewRow label={labels.reviewLabelWhatsapp} value={form.whatsapp} accent />
              {form.email && <ReviewRow label={labels.reviewLabelEmail} value={form.email} />}
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/></svg>
                <p className="text-xs text-blue-700">{labels.reviewNote}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Navigation ───────────────────────────────────────────── */}
      <div className="mt-5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => step > 1 && setStep((s) => (s - 1) as Step)}
          disabled={step === 1}
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
          {labels.back}
        </button>
        {step < 4 ? (
          <button
            type="button"
            onClick={next}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-orange-500 px-7 text-sm font-bold text-white shadow-md shadow-orange-200 transition hover:bg-orange-600 active:scale-95"
          >
            {labels.continue}
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-7 text-sm font-bold text-white shadow-md shadow-emerald-200 transition hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={3} strokeOpacity={0.3}/><path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth={3} strokeLinecap="round"/></svg>
                {labels.submitting}
              </>
            ) : (
              <>
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/></svg>
                {labels.submit}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

const INPUT_CLS =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100 hover:border-slate-300';

function Field({
  label, children, note, noteColor,
}: {
  label: string;
  children: React.ReactNode;
  note?: string;
  noteColor?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-bold uppercase tracking-wide text-slate-600">{label}</label>
      {children}
      {note && <p className={`text-[11px] ${noteColor ?? 'text-slate-400'}`}>{note}</p>}
    </div>
  );
}

function ReviewRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <span className={`text-sm font-semibold ${accent ? 'text-emerald-700' : 'text-slate-800'}`}>{value || '—'}</span>
    </div>
  );
}
