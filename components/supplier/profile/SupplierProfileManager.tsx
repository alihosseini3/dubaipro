'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import type { CompanyType, SupplierDocumentType, SupplierOnboardingStatus } from '@prisma/client';

import {
  COMPANY_TYPES,
  UAE_EMIRATES,
  isValidPhone,
} from '@/lib/supplier/registration';
import { MapLocationPicker } from '@/components/supplier/MapLocationPicker';
import { CategoryTreePicker, type PickerCategory } from './CategoryTreePicker';
import { ProfileMediaManager, type MediaDoc } from './ProfileMediaManager';
import { BannerCropModal } from './BannerCropModal';


const inputClass =
  'block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/15';
const labelClass = 'block text-sm font-medium text-slate-700';

export type ProfileInitial = {
  email: string;
  name: string;
  slug: string | null;
  status: string;
  onboardingStatus: SupplierOnboardingStatus;
  logoUrl: string | null;
  bannerUrl: string | null;
  shortTagline: string | null;
  description: string | null;
  companyName: string | null;
  tradeName: string | null;
  tradeLicenseNumber: string | null;
  companyType: CompanyType | null;
  phones: string[];
  country: string | null;
  emirate: string | null;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  primaryCategoryId: string | null;
  secondaryCategoryIds: string[];
  documents: MediaDoc[];
};

type Props = {
  locale: string;
  initial: ProfileInitial;
  categories: PickerCategory[];
};

const STATUS_TONE: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  PENDING_REVIEW: 'bg-amber-50 text-amber-700 ring-amber-200',
  SUSPENDED: 'bg-red-50 text-red-700 ring-red-200',
  BLACKLISTED: 'bg-red-50 text-red-700 ring-red-200',
};

const ONBOARDING_TONE: Record<SupplierOnboardingStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  PENDING: 'bg-amber-50 text-amber-700',
  APPROVED: 'bg-emerald-50 text-emerald-700',
  REJECTED: 'bg-red-50 text-red-700',
};

async function postRegister(payload: unknown): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('/api/supplier/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  return { ok: res.ok, error: json.error };
}

export function SupplierProfileManager({ locale, initial, categories }: Props) {
  const t = useTranslations('supplier.profile');
  const currentLocale = useLocale();

  async function aiTranslate(text: string, setter: (v: string) => void, setLoading: (v: boolean) => void) {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/supplier/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, targetLocale: currentLocale, sourceLocale: 'fa' }),
      });
      const json = (await res.json().catch(() => ({}))) as { translated?: string; error?: string };
      if (json.translated) setter(json.translated);
    } finally {
      setLoading(false);
    }
  }

  const COMPANY_TYPE_LABELS: Record<CompanyType, string> = {
    MANUFACTURER: t('typeManufacturer'),
    TRADING_COMPANY: t('typeTradingCompany'),
    DISTRIBUTOR: t('typeDistributor'),
    WHOLESALER: t('typeWholesaler'),
    RETAILER: t('typeRetailer'),
    SERVICE_PROVIDER: t('typeServiceProvider'),
  };

  // Branding
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl);
  const [bannerUrl, setBannerUrl] = useState(initial.bannerUrl);
  const [tagline, setTagline] = useState(initial.shortTagline ?? '');
  const [description, setDescription] = useState(initial.description ?? '');
  const [taglineTranslating, setTaglineTranslating] = useState(false);
  const [descTranslating, setDescTranslating] = useState(false);

  // Company
  const [companyName, setCompanyName] = useState(initial.companyName ?? '');
  const [tradeName, setTradeName] = useState(initial.tradeName ?? '');
  const [tradeLicenseNumber, setTradeLicenseNumber] = useState(initial.tradeLicenseNumber ?? '');
  const [companyType, setCompanyType] = useState<CompanyType | ''>(initial.companyType ?? '');

  // Contact
  const [phones, setPhones] = useState<string[]>(initial.phones.length ? initial.phones : ['']);

  // Location
  const [country, setCountry] = useState(initial.country ?? 'AE');
  const [emirate, setEmirate] = useState(initial.emirate ?? '');
  const [city, setCity] = useState(initial.city ?? '');
  const [address, setAddress] = useState(initial.address ?? '');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    initial.latitude != null && initial.longitude != null
      ? { lat: initial.latitude, lng: initial.longitude }
      : null
  );

  // Categories
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    [
      ...(initial.primaryCategoryId ? [initial.primaryCategoryId] : []),
      ...initial.secondaryCategoryIds,
    ].filter((v, i, arr) => arr.indexOf(v) === i)
  );

  const [onboardingStatus, setOnboardingStatus] = useState(initial.onboardingStatus);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [bannerBusy, setBannerBusy] = useState(false);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [pendingBannerFile, setPendingBannerFile] = useState<File | null>(null);

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? id;
  const statusTone = STATUS_TONE[initial.status] ?? STATUS_TONE.PENDING_REVIEW;
  const onbTone = ONBOARDING_TONE[onboardingStatus];
  const statusLabelKey = initial.status === 'ACTIVE' ? 'statusActive'
    : initial.status === 'SUSPENDED' ? 'statusSuspended'
    : initial.status === 'BLACKLISTED' ? 'statusBlocked'
    : 'statusPending';
  const onbLabelKey = onboardingStatus === 'DRAFT' ? 'onbDraft'
    : onboardingStatus === 'PENDING' ? 'onbPending'
    : onboardingStatus === 'APPROVED' ? 'onbApproved'
    : 'onbRejected';
  const storefrontHref = initial.slug ? `/${locale}/suppliers/${initial.slug}` : null;

  async function uploadImage(target: 'logo' | 'banner', file: File) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`/api/supplier/me/image?target=${target}`, { method: 'POST', body: fd });
    const json = (await res.json().catch(() => ({}))) as { data?: { url: string }; error?: string };
    if (!res.ok || !json.data) throw new Error(json.error ?? 'Upload failed');
    if (target === 'logo') setLogoUrl(json.data.url);
    else setBannerUrl(json.data.url);
  }

  async function handleHeaderUpload(target: 'logo' | 'banner', file: File) {
    if (target === 'banner') {
      setPendingBannerFile(file);
      return;
    }
    setLogoBusy(true);
    setHeaderError(null);
    try {
      await uploadImage(target, file);
    } catch (err) {
      setHeaderError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLogoBusy(false);
    }
  }

  async function handleBannerCropConfirm(blob: Blob) {
    setPendingBannerFile(null);
    setBannerBusy(true);
    setHeaderError(null);
    try {
      const croppedFile = new File([blob], 'banner.jpg', { type: 'image/jpeg' });
      await uploadImage('banner', croppedFile);
    } catch (err) {
      setHeaderError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBannerBusy(false);
    }
  }

  async function handleSubmitForReview() {
    setSubmitting(true);
    setSubmitMsg(null);
    const { ok, error } = await postRegister({ submit: true });
    setSubmitting(false);
    if (ok) {
      setOnboardingStatus('PENDING');
      setSubmitMsg('Your profile has been submitted for review.');
    } else {
      setSubmitMsg(error ?? 'Please complete all required fields before submitting.');
    }
  }

  return (
    <>
    {pendingBannerFile && (
      <BannerCropModal
        file={pendingBannerFile}
        onConfirm={handleBannerCropConfirm}
        onCancel={() => setPendingBannerFile(null)}
      />
    )}
    <div className="space-y-6">
      {/* Header / hero */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="relative h-32 bg-gradient-to-br from-slate-800 to-slate-900 sm:h-44 lg:h-52">
          {bannerUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bannerUrl} alt="" className="h-full w-full object-cover" />
          )}
          <label className="absolute end-3 top-3 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-black/45 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur transition hover:bg-black/60">
            <CameraIcon />
            <span className="hidden sm:inline">{bannerBusy ? 'Uploading…' : bannerUrl ? 'Change cover' : 'Add cover'}</span>
            <input
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/webp,image/avif"
              disabled={bannerBusy}
              onChange={(e) => { if (e.target.files?.[0]) void handleHeaderUpload('banner', e.target.files[0]); e.target.value = ''; }}
            />
          </label>
        </div>
        <div className="px-4 pb-5 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              {/* Avatar with inline logo upload */}
              <div className="relative -mt-12 shrink-0 sm:-mt-14">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-gradient-to-br from-orange-500 to-orange-600 text-3xl font-bold text-white shadow-md sm:h-28 sm:w-28">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (initial.name.charAt(0) || 'S').toUpperCase()
                  )}
                </div>
                <label
                  className="absolute -bottom-1 -end-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-orange-600 text-white shadow-md transition hover:bg-orange-700"
                  title={logoUrl ? 'Change logo' : 'Add logo'}
                >
                  {logoBusy ? <Spinner /> : <CameraIcon />}
                  <input
                    type="file"
                    className="hidden"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    disabled={logoBusy}
                    onChange={(e) => { if (e.target.files?.[0]) void handleHeaderUpload('logo', e.target.files[0]); e.target.value = ''; }}
                  />
                </label>
              </div>
              <div className="min-w-0 pb-1">
                <h1 className="truncate text-xl font-bold text-slate-900 sm:text-2xl">{initial.name}</h1>
                <p className="truncate text-sm text-slate-500">{initial.email}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end sm:pb-1">
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ring-1 ring-inset ${statusTone}`}>
                {t(statusLabelKey as Parameters<typeof t>[0])}
              </span>
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${onbTone}`}>
                {t(onbLabelKey as Parameters<typeof t>[0])}
              </span>
              {storefrontHref && (
                <Link href={storefrontHref} target="_blank" className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
                  {t('viewStorefront')}
                </Link>
              )}
            </div>
          </div>

          {headerError && <p className="mt-3 text-xs font-medium text-red-600">{headerError}</p>}

          {onboardingStatus === 'DRAFT' && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm text-amber-800">
                Your profile is a <strong>draft</strong>. Submit it for review to go live.
              </p>
              <button
                type="button"
                onClick={handleSubmitForReview}
                disabled={submitting}
                className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:opacity-60"
              >
                {submitting ? 'Submitting…' : 'Submit for review'}
              </button>
            </div>
          )}
          {submitMsg && <p className="mt-3 text-sm font-medium text-slate-600">{submitMsg}</p>}
        </div>
      </div>

      {/* Branding */}
      <EditableCard
        title={t('branding')}
        description={t('brandingDesc')}
        t={t}
        renderView={() => (
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label={t('tagline')} value={tagline || '—'} />
            <Field label={t('description')} value={description || '—'} />
          </dl>
        )}
        renderEdit={() => (
          <div className="grid gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <ImageUploader
                label={t('logo')}
                url={logoUrl}
                square
                onUpload={(f) => uploadImage('logo', f)}
                onClear={async () => {
                  await fetch('/api/supplier/me/image?target=logo', { method: 'DELETE' });
                  setLogoUrl(null);
                }}
              />
              <ImageUploader
                label={t('banner')}
                url={bannerUrl}
                onUpload={(f) => uploadImage('banner', f)}
                onClear={async () => {
                  await fetch('/api/supplier/me/image?target=banner', { method: 'DELETE' });
                  setBannerUrl(null);
                }}
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className={labelClass} htmlFor="tagline">{t('tagline')}</label>
                {currentLocale !== 'fa' && (
                  <button
                    type="button"
                    disabled={taglineTranslating || !tagline.trim()}
                    onClick={() => void aiTranslate(tagline, setTagline, setTaglineTranslating)}
                    className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 transition hover:bg-violet-100 disabled:opacity-50"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
                      <path d="M7 2a1 1 0 011 1v1h3a1 1 0 110 2H9.578a7.002 7.002 0 01-1.516 2.948l.455.35a1 1 0 11-1.234 1.573l-.444-.342A6.98 6.98 0 016 12H5a1 1 0 110-2h.022A4.998 4.998 0 006.87 8H7a1 1 0 110-2h1V3a1 1 0 011-1zm6 6a1 1 0 01.894.553l2.991 5.982a.869.869 0 01.02.037l.99 1.98a1 1 0 11-1.79.895L15.383 16h-4.764l-.724 1.447a1 1 0 11-1.788-.894l.99-1.98.019-.038 2.99-5.982A1 1 0 0113 8zm-1.382 6h2.764L13 11.236 11.618 14z" />
                    </svg>
                    {taglineTranslating ? t('aiTranslating') : t('aiTranslate')}
                  </button>
                )}
              </div>
              <input id="tagline" className={inputClass} maxLength={160} value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder={t('taglinePlaceholder')} />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className={labelClass} htmlFor="description">{t('description')}</label>
                {currentLocale !== 'fa' && (
                  <button
                    type="button"
                    disabled={descTranslating || !description.trim()}
                    onClick={() => void aiTranslate(description, setDescription, setDescTranslating)}
                    className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 transition hover:bg-violet-100 disabled:opacity-50"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
                      <path d="M7 2a1 1 0 011 1v1h3a1 1 0 110 2H9.578a7.002 7.002 0 01-1.516 2.948l.455.35a1 1 0 11-1.234 1.573l-.444-.342A6.98 6.98 0 016 12H5a1 1 0 110-2h.022A4.998 4.998 0 006.87 8H7a1 1 0 110-2h1V3a1 1 0 011-1zm6 6a1 1 0 01.894.553l2.991 5.982a.869.869 0 01.02.037l.99 1.98a1 1 0 11-1.79.895L15.383 16h-4.764l-.724 1.447a1 1 0 11-1.788-.894l.99-1.98.019-.038 2.99-5.982A1 1 0 0113 8zm-1.382 6h2.764L13 11.236 11.618 14z" />
                    </svg>
                    {descTranslating ? t('aiTranslating') : t('aiTranslate')}
                  </button>
                )}
              </div>
              <textarea id="description" rows={5} className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('descriptionPlaceholder')} />
            </div>
          </div>
        )}
        onSave={async () => {
          const res = await fetch('/api/supplier/me', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shortTagline: tagline.trim() || null, description: description.trim() || null }),
          });
          if (!res.ok) {
            const j = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(j.error ?? 'Save failed');
          }
        }}
      />

      {/* Company */}
      <EditableCard
        title={t('company')}
        description={t('companyDesc')}
        t={t}
        renderView={() => (
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label={t('companyName')} value={companyName || '—'} />
            <Field label={t('tradeName')} value={tradeName || '—'} />
            <Field label={t('tradeLicense')} value={tradeLicenseNumber || '—'} />
            <Field label={t('companyType')} value={companyType ? COMPANY_TYPE_LABELS[companyType] : '—'} />
          </dl>
        )}
        renderEdit={() => (
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{t('companyName')}</label>
                <input className={inputClass} value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>{t('tradeName')}</label>
                <input className={inputClass} value={tradeName} onChange={(e) => setTradeName(e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelClass}>{t('tradeLicense')}</label>
              <input className={inputClass} value={tradeLicenseNumber} onChange={(e) => setTradeLicenseNumber(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>{t('companyType')}</label>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {COMPANY_TYPES.map((ct) => (
                  <button
                    type="button"
                    key={ct}
                    onClick={() => setCompanyType(ct)}
                    className={`rounded-xl border px-4 py-2.5 text-left text-sm font-medium transition ${
                      companyType === ct
                        ? 'border-orange-500 bg-orange-50 text-orange-700 ring-2 ring-orange-500/20'
                        : 'border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {COMPANY_TYPE_LABELS[ct]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        onSave={async () => {
          const { ok, error } = await postRegister({
            company: {
              companyName: companyName.trim(),
              tradeName: tradeName.trim() || null,
              tradeLicenseNumber: tradeLicenseNumber.trim(),
              companyType: companyType || undefined,
            },
          });
          if (!ok) throw new Error(error ?? 'Save failed');
        }}
      />

      {/* Contact */}
      <EditableCard
        title={t('contact')}
        description={t('contactDesc')}
        t={t}
        renderView={() => (
          <div className="space-y-2">
            <Field label={t('loginEmail')} value={initial.email} />
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{t('phoneNumbers')}</dt>
              <dd className="mt-1 flex flex-wrap gap-2">
                {phones.filter(Boolean).length === 0 ? (
                  <span className="text-sm text-slate-500">—</span>
                ) : (
                  phones.filter(Boolean).map((p, i) => (
                    <span key={i} className="rounded-lg bg-slate-100 px-2.5 py-1 text-sm font-medium text-slate-700">{p}</span>
                  ))
                )}
              </dd>
            </div>
          </div>
        )}
        renderEdit={() => (
          <div>
            <label className={labelClass}>Phone numbers</label>
            <div className="mt-1.5 space-y-2">
              {phones.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className={inputClass}
                    value={p}
                    onChange={(e) => setPhones((prev) => prev.map((x, idx) => (idx === i ? e.target.value : x)))}
                    placeholder="+9715XXXXXXXX"
                  />
                  {phones.length > 1 && (
                    <button type="button" onClick={() => setPhones((prev) => prev.filter((_, idx) => idx !== i))} className="shrink-0 rounded-xl border border-slate-200 px-3 text-slate-500 transition hover:border-red-300 hover:text-red-600" aria-label="Remove number">
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4" aria-hidden><path d="M5 5l10 10M15 5L5 15" /></svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setPhones((prev) => [...prev, ''])} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-orange-600 hover:text-orange-700">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4" aria-hidden><path d="M10 4v12M4 10h12" /></svg>
              Add another number
            </button>
          </div>
        )}
        onSave={async () => {
          const cleaned = phones.map((p) => p.trim()).filter(Boolean);
          if (cleaned.length === 0) throw new Error('Add at least one number');
          if (!cleaned.every((p) => isValidPhone(p))) throw new Error('One or more numbers are invalid');
          const { ok, error } = await postRegister({ account: { phones: cleaned } });
          if (!ok) throw new Error(error ?? 'Save failed');
          setPhones(cleaned);
        }}
      />

      {/* Location */}
      <EditableCard
        title={t('location')}
        description={t('locationDesc')}
        t={t}
        renderView={() => (
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label={t('country')} value={country || '—'} />
            <Field label={t('emirate')} value={emirate || '—'} />
            <Field label={t('city')} value={city || '—'} />
            <Field label={t('address')} value={address || '—'} />
            <Field label={t('mapPin')} value={coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : t('mapPinNotSet')} />
          </dl>
        )}
        renderEdit={() => (
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{t('country')}</label>
                <input className={inputClass} value={country} onChange={(e) => setCountry(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>{t('emirate')}</label>
                <select className={inputClass} value={emirate} onChange={(e) => setEmirate(e.target.value)}>
                  <option value="">Select emirate…</option>
                  {UAE_EMIRATES.map((em) => <option key={em} value={em}>{em}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass}>{t('city')}</label>
              <input className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>{t('address')}</label>
              <textarea rows={2} className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>{t('pinMap')}</label>
              <div className="mt-1.5">
                <MapLocationPicker value={coords} onChange={setCoords} />
              </div>
            </div>
          </div>
        )}
        onSave={async () => {
          const { ok, error } = await postRegister({
            location: {
              country: country.trim(),
              emirate: emirate.trim(),
              city: city.trim(),
              address: address.trim(),
              latitude: coords?.lat ?? null,
              longitude: coords?.lng ?? null,
            },
          });
          if (!ok) throw new Error(error ?? 'Save failed');
        }}
      />

      {/* Categories */}
      <EditableCard
        title={t('categories')}
        description={t('categoriesDesc')}
        t={t}
        renderView={() => (
          <div className="flex flex-wrap gap-2">
            {selectedCategoryIds.length === 0 ? (
              <span className="text-sm text-slate-500">{t('noCategoriesSelected')}</span>
            ) : (
              selectedCategoryIds.map((id, i) => (
                <span key={id} className={`rounded-full px-3 py-1 text-sm font-medium ${i === 0 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-700'}`}>
                  {i === 0 ? '★ ' : ''}{categoryName(id)}
                </span>
              ))
            )}
          </div>
        )}
        renderEdit={() => (
          <div className="grid gap-2">
            <p className="text-sm text-slate-500">The first selected category is your primary category.</p>
            <CategoryTreePicker categories={categories} value={selectedCategoryIds} onChange={setSelectedCategoryIds} />
          </div>
        )}
        onSave={async () => {
          if (selectedCategoryIds.length === 0) throw new Error('Select at least one category');
          const { ok, error } = await postRegister({
            categories: {
              primaryCategoryId: selectedCategoryIds[0],
              secondaryCategoryIds: selectedCategoryIds.slice(1),
            },
          });
          if (!ok) throw new Error(error ?? 'Save failed');
        }}
      />

      {/* Media */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-100 px-4 py-4 sm:px-6">
          <h2 className="text-[15px] font-semibold text-slate-900">{t('media')}</h2>
          <p className="mt-0.5 text-[13px] text-slate-500">{t('mediaDesc')}</p>
        </header>
        <div className="p-4 sm:p-6">
          <ProfileMediaManager initialDocuments={initial.documents} />
        </div>
      </section>
    </div>
    </>
  );
}

/* ── Helpers ──────────────────────────────────────────────────────────── */

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 break-words text-sm text-slate-800">{value}</dd>
    </div>
  );
}

function EditableCard({
  title,
  description,
  renderView,
  renderEdit,
  onSave,
  t,
}: {
  title: string;
  description: string;
  renderView: () => ReactNode;
  renderEdit: () => ReactNode;
  onSave: () => Promise<void>;
  t: (key: string) => string;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await onSave();
      setEditing(false);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
          <p className="mt-0.5 text-[13px] text-slate-500">{description}</p>
        </div>
        <div className="flex flex-none items-center gap-2">
          {saved && <span className="text-xs font-semibold text-emerald-600">{t('saved')}</span>}
          {editing ? (
            <>
              <button type="button" onClick={() => { setEditing(false); setError(null); }} disabled={saving} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60">
                {t('cancel')}
              </button>
              <button type="button" onClick={handleSave} disabled={saving} className="rounded-lg bg-orange-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:opacity-60">
                {saving ? t('saving') : t('save')}
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
                <path d="M4 13.5V16h2.5l7-7L11 6.5l-7 7zM13 4.5L15.5 7" />
              </svg>
              {t('edit')}
            </button>
          )}
        </div>
      </header>
      <div className="p-4 sm:p-6">
        {error && <p className="mb-3 text-sm font-medium text-red-600">{error}</p>}
        {editing ? renderEdit() : renderView()}
      </div>
    </section>
  );
}

function ImageUploader({
  label,
  url,
  square,
  onUpload,
  onClear,
}: {
  label: string;
  url: string | null;
  square?: boolean;
  onUpload: (file: File) => Promise<void>;
  onClear: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(file: File) {
    setBusy(true);
    setError(null);
    try {
      await onUpload(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className={`mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 ${square ? 'aspect-square w-28' : 'aspect-[3/1]'}`}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">No {label.toLowerCase()}</div>
        )}
      </div>
      <div className="mt-2 flex items-center gap-3">
        <label className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
          {busy ? 'Uploading…' : url ? 'Replace' : 'Upload'}
          <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp,image/avif" disabled={busy} onChange={(e) => { if (e.target.files?.[0]) void handle(e.target.files[0]); e.target.value = ''; }} />
        </label>
        {url && (
          <button type="button" onClick={() => void onClear()} className="text-xs font-semibold text-red-600 hover:underline">
            Remove
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
