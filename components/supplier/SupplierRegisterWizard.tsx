'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';

import {
  COMPANY_TYPES,
  UAE_EMIRATES,
  ALLOWED_DOCUMENT_MIME_TYPES,
  ALLOWED_VIDEO_MIME_TYPES,
  DOCUMENT_LIMITS,
  MAX_DOCUMENT_BYTES,
  MAX_VIDEO_BYTES,
  MIN_STORE_PHOTOS,
  REQUIRED_DOCUMENT_TYPES,
  DEFAULT_COUNTRY,
  EMAIL_RE,
  isAllowedDocumentMime,
  isAllowedVideoMime,
  isStrongPassword,
  isValidPhone,
  type SupplierRegisterPayload,
  type SupplierRegistrationState,
} from '@/lib/supplier/registration';
import type { CompanyType, SupplierDocumentType } from '@prisma/client';
import { MapLocationPicker } from './MapLocationPicker';

export type WizardCategory = { id: string; name: string; parentId: string | null };

type Props = {
  locale: string;
  categories: WizardCategory[];
  isAuthenticated: boolean;
  initialState: SupplierRegistrationState | null;
};

type FieldErrors = Record<string, string>;
type DocItem = SupplierRegistrationState['documents'][number];

const COMPANY_TYPE_LABELS: Record<CompanyType, string> = {
  MANUFACTURER: 'Manufacturer',
  TRADING_COMPANY: 'Trading Company',
  DISTRIBUTOR: 'Distributor',
  WHOLESALER: 'Wholesaler',
  RETAILER: 'Retailer',
  SERVICE_PROVIDER: 'Service Provider',
};

const STEPS = [
  { label: 'Account', desc: 'Your login & contact details' },
  { label: 'Company', desc: 'Tell us about your business' },
  { label: 'Location', desc: 'Where buyers can find you' },
  { label: 'Categories', desc: 'What you sell' },
  { label: 'Documents', desc: 'Verification & store media' },
] as const;

const inputClass =
  'block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/15 disabled:cursor-not-allowed disabled:bg-slate-50';
const labelClass = 'block text-sm font-medium text-slate-700';
const errorClass = 'mt-1 text-xs font-medium text-red-600';

const DOC_ACCEPT = ALLOWED_DOCUMENT_MIME_TYPES.join(',');
const VIDEO_ACCEPT = ALLOWED_VIDEO_MIME_TYPES.join(',');

function isImageUrl(url: string): boolean {
  return /\.(jpe?g|png|webp|gif)$/i.test(url);
}

export function SupplierRegisterWizard({
  locale,
  categories,
  isAuthenticated,
  initialState,
}: Props) {
  const [step, setStep] = useState(isAuthenticated ? 1 : 0);
  const [maxReached, setMaxReached] = useState(isAuthenticated ? 1 : 0);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(initialState?.onboardingStatus === 'PENDING');
  const [accountCreated, setAccountCreated] = useState(isAuthenticated);
  const [draftSaved, setDraftSaved] = useState(false);

  // Step 1 — account
  const [name, setName] = useState('');
  const [phones, setPhones] = useState<string[]>(
    initialState?.phones?.length ? initialState.phones : ['']
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Step 2 — company
  const [companyName, setCompanyName] = useState(initialState?.companyName ?? '');
  const [tradeName, setTradeName] = useState(initialState?.tradeName ?? '');
  const [tradeLicenseNumber, setTradeLicenseNumber] = useState(
    initialState?.tradeLicenseNumber ?? ''
  );
  const [companyType, setCompanyType] = useState<CompanyType | ''>(
    initialState?.companyType ?? ''
  );

  // Step 3 — location
  const [country, setCountry] = useState(initialState?.country ?? DEFAULT_COUNTRY);
  const [emirate, setEmirate] = useState(initialState?.emirate ?? '');
  const [city, setCity] = useState(initialState?.city ?? '');
  const [address, setAddress] = useState(initialState?.address ?? '');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    initialState?.latitude != null && initialState?.longitude != null
      ? { lat: initialState.latitude, lng: initialState.longitude }
      : null
  );

  // Step 4 — categories (multi-select tree). The first selected id becomes
  // the primary category; the rest are stored as secondary categories.
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(() => {
    if (!initialState) return [];
    return [
      ...(initialState.primaryCategoryId ? [initialState.primaryCategoryId] : []),
      ...initialState.secondaryCategoryIds,
    ].filter((v, i, arr) => arr.indexOf(v) === i);
  });

  // Step 5 — documents / media
  const [documents, setDocuments] = useState<DocItem[]>(initialState?.documents ?? []);
  const [uploadingType, setUploadingType] = useState<SupplierDocumentType | null>(null);

  const topRef = useRef<HTMLDivElement>(null);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name)),
    [categories]
  );

  // Group categories into a parent → children tree for the picker.
  const categoryTree = useMemo(() => {
    const roots = sortedCategories.filter((c) => !c.parentId);
    const childrenByParent = new Map<string, WizardCategory[]>();
    for (const c of sortedCategories) {
      if (c.parentId) {
        const arr = childrenByParent.get(c.parentId) ?? [];
        arr.push(c);
        childrenByParent.set(c.parentId, arr);
      }
    }
    return roots.map((root) => ({ ...root, children: childrenByParent.get(root.id) ?? [] }));
  }, [sortedCategories]);

  const docsByType = useMemo(() => {
    const map = new Map<SupplierDocumentType, DocItem[]>();
    for (const d of documents) {
      const arr = map.get(d.type) ?? [];
      arr.push(d);
      map.set(d.type, arr);
    }
    return map;
  }, [documents]);

  const storePhotoCount = docsByType.get('STORE_PHOTO')?.length ?? 0;

  function scrollTop() {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function clearErrors() {
    setFormError(null);
    setFieldErrors({});
  }

  async function postPayload(
    payload: SupplierRegisterPayload
  ): Promise<SupplierRegistrationState | null> {
    const res = await fetch('/api/supplier/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => ({}))) as {
      data?: SupplierRegistrationState;
      error?: string;
      details?: FieldErrors;
    };
    if (!res.ok) {
      if (json.details) setFieldErrors(json.details);
      throw new Error(json.error ?? 'Something went wrong. Please try again.');
    }
    return json.data ?? null;
  }

  // ── validation ────────────────────────────────────────────────────────
  function validateAccount(): FieldErrors {
    const e: FieldErrors = {};
    if (!name.trim()) e.name = 'Full name is required';
    if (!EMAIL_RE.test(email.trim())) e.email = 'A valid email is required';
    const cleaned = phones.map((p) => p.trim()).filter(Boolean);
    if (cleaned.length === 0) e.phones = 'Add at least one mobile number';
    else if (!cleaned.every((p) => isValidPhone(p))) e.phones = 'One or more numbers are invalid';
    if (!isStrongPassword(password)) {
      e.password = 'Use 8+ characters with at least one letter and one number';
    }
    if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match';
    return e;
  }
  function validateCompany(): FieldErrors {
    const e: FieldErrors = {};
    if (!companyName.trim()) e.companyName = 'Company name is required';
    if (!tradeLicenseNumber.trim()) e.tradeLicenseNumber = 'Trade license number is required';
    if (!companyType) e.companyType = 'Select a company type';
    return e;
  }
  function validateLocation(): FieldErrors {
    const e: FieldErrors = {};
    if (!country.trim()) e.country = 'Country is required';
    if (!emirate.trim()) e.emirate = 'Emirate is required';
    if (!city.trim()) e.city = 'City is required';
    if (!address.trim()) e.address = 'Address is required';
    return e;
  }
  function validateCategories(): FieldErrors {
    const e: FieldErrors = {};
    if (selectedCategoryIds.length === 0) e.categories = 'Select at least one category';
    return e;
  }
  function validateStep(target: number): FieldErrors {
    switch (target) {
      case 0: return validateAccount();
      case 1: return validateCompany();
      case 2: return validateLocation();
      case 3: return validateCategories();
      default: return {};
    }
  }

  function payloadForStep(target: number): SupplierRegisterPayload {
    switch (target) {
      case 0:
        return {
          account: {
            name: name.trim(),
            email: email.trim(),
            phones: phones.map((p) => p.trim()).filter(Boolean),
            password,
          },
        };
      case 1:
        return {
          company: {
            companyName: companyName.trim(),
            tradeName: tradeName.trim() || null,
            tradeLicenseNumber: tradeLicenseNumber.trim(),
            companyType: companyType as CompanyType,
          },
        };
      case 2:
        return {
          location: {
            country: country.trim(),
            emirate: emirate.trim(),
            city: city.trim(),
            address: address.trim(),
            latitude: coords?.lat ?? null,
            longitude: coords?.lng ?? null,
          },
        };
      case 3:
        return {
          categories: {
            primaryCategoryId: selectedCategoryIds[0] ?? '',
            secondaryCategoryIds: selectedCategoryIds.slice(1),
          },
        };
      default:
        return {};
    }
  }

  function syncFromState(state: SupplierRegistrationState) {
    setDocuments(state.documents);
    setSelectedCategoryIds(
      [
        ...(state.primaryCategoryId ? [state.primaryCategoryId] : []),
        ...state.secondaryCategoryIds,
      ].filter((v, i, arr) => arr.indexOf(v) === i)
    );
  }

  // ── navigation ──────────────────────────────────────────────────────
  async function handleNext() {
    clearErrors();
    const errs = validateStep(step);
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setPending(true);
    try {
      const state = await postPayload(payloadForStep(step));
      if (step === 0) setAccountCreated(true);
      if (state) syncFromState(state);
      const next = Math.min(step + 1, STEPS.length - 1);
      setStep(next);
      setMaxReached((m) => Math.max(m, next));
      scrollTop();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setPending(false);
    }
  }

  function handleBack() {
    clearErrors();
    const floor = accountCreated ? 1 : 0;
    setStep((s) => Math.max(s - 1, floor));
    scrollTop();
  }

  function goToStep(target: number) {
    if (target > maxReached) return;
    if (accountCreated && target === 0) return;
    clearErrors();
    setStep(target);
    scrollTop();
  }

  async function handleSaveDraft() {
    clearErrors();
    if (!accountCreated) {
      setFormError('Complete the account step first to save a draft.');
      return;
    }
    setPending(true);
    try {
      await postPayload(payloadForStep(step));
      setDraftSaved(true);
      window.setTimeout(() => setDraftSaved(false), 2500);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setPending(false);
    }
  }

  // ── phone helpers ───────────────────────────────────────────────────
  function updatePhone(i: number, v: string) {
    setPhones((prev) => prev.map((p, idx) => (idx === i ? v : p)));
  }
  function addPhone() {
    setPhones((prev) => [...prev, '']);
  }
  function removePhone(i: number) {
    setPhones((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  // ── upload / delete ─────────────────────────────────────────────────
  async function uploadOne(type: SupplierDocumentType, file: File) {
    const isVideo = type === 'STORE_VIDEO';
    const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_DOCUMENT_BYTES;
    if (file.size > maxBytes) {
      throw new Error(`File exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB limit`);
    }
    const mimeOk = isVideo ? isAllowedVideoMime(file.type) : isAllowedDocumentMime(file.type);
    if (!mimeOk) {
      throw new Error(isVideo ? 'Allowed: MP4, WEBM, MOV' : 'Allowed: PDF, JPG, PNG, WEBP');
    }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('type', type);
    const res = await fetch('/api/supplier/upload', { method: 'POST', body: fd });
    const json = (await res.json().catch(() => ({}))) as { data?: DocItem; error?: string };
    if (!res.ok || !json.data) throw new Error(json.error ?? 'Upload failed');
    return json.data;
  }

  async function handleFiles(type: SupplierDocumentType, files: FileList) {
    clearErrors();
    setUploadingType(type);
    const isGallery = type === 'STORE_PHOTO' || type === 'WAREHOUSE_PHOTO';
    try {
      const list = Array.from(files);
      for (const file of list) {
        const current = documents.filter((d) => d.type === type).length;
        if (isGallery && current >= DOCUMENT_LIMITS[type]) {
          setFieldErrors({ [type]: `Maximum ${DOCUMENT_LIMITS[type]} files` });
          break;
        }
        // eslint-disable-next-line no-await-in-loop
        const uploaded = await uploadOne(type, file);
        setDocuments((prev) =>
          isGallery ? [...prev, uploaded] : [...prev.filter((d) => d.type !== type), uploaded]
        );
      }
    } catch (err) {
      setFieldErrors({ [type]: err instanceof Error ? err.message : 'Upload failed' });
    } finally {
      setUploadingType(null);
    }
  }

  async function handleDeleteDoc(id: string) {
    clearErrors();
    try {
      const res = await fetch(`/api/supplier/upload?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? 'Delete failed');
      }
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  async function handleSubmit() {
    clearErrors();
    const missing = REQUIRED_DOCUMENT_TYPES.filter((t) => !documents.some((d) => d.type === t));
    if (missing.length > 0) {
      setFormError('Please upload the required Trade License and Emirates ID / Passport.');
      return;
    }
    if (storePhotoCount < MIN_STORE_PHOTOS) {
      setFormError(`Please upload at least ${MIN_STORE_PHOTOS} store photos (${storePhotoCount} so far).`);
      return;
    }
    setPending(true);
    try {
      const state = await postPayload({ submit: true });
      if (state) syncFromState(state);
      setSubmitted(true);
      scrollTop();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setPending(false);
    }
  }

  function toggleCategory(id: string) {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  // ── success ─────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-20 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8" aria-hidden>
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="mt-6 text-2xl font-bold text-slate-900">Application submitted</h1>
        <p className="mt-3 text-slate-600">
          Thanks! Your supplier application is now <strong>pending review</strong>. We&apos;ll
          notify you by email once it has been processed.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href={`/${locale}/supplier`} className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
            Go to dashboard
          </Link>
          <Link href={`/${locale}`} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Back home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div ref={topRef} className="mx-auto w-full max-w-4xl px-4 py-10">
      {/* Header */}
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-lg sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-400">
          Supplier registration
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
          Become a verified supplier
        </h1>
        <p className="mt-2 max-w-xl text-sm text-slate-300">
          List your company, showcase your store, and start receiving orders and RFQs from
          verified buyers across the region.
        </p>
      </div>

      {/* Stepper */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <ol className="flex items-center">
          {STEPS.map((s, i) => {
            const done = i < step;
            const active = i === step;
            const clickable = i <= maxReached && !(accountCreated && i === 0);
            return (
              <li key={s.label} className="flex flex-1 items-center last:flex-none">
                <button
                  type="button"
                  onClick={() => goToStep(i)}
                  disabled={!clickable}
                  className={`flex items-center gap-2 ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition ${
                      done
                        ? 'bg-orange-600 text-white'
                        : active
                          ? 'bg-orange-100 text-orange-700 ring-2 ring-orange-500'
                          : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {done ? (
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
                        <path d="M4 10l4 4 8-8" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span className="hidden text-left sm:block">
                    <span className={`block text-sm font-semibold ${active ? 'text-slate-900' : 'text-slate-500'}`}>
                      {s.label}
                    </span>
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <span className={`mx-2 h-0.5 flex-1 rounded ${i < step ? 'bg-orange-500' : 'bg-slate-200'}`} />
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {/* Card */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-slate-900">{STEPS[step].label}</h2>
          <p className="text-sm text-slate-500">{STEPS[step].desc}</p>
        </div>

        {formError && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {formError}
          </div>
        )}

        {/* Step 1 — Account */}
        {step === 0 && (
          <div className="grid gap-4">
            <div>
              <label className={labelClass} htmlFor="name">Full name</label>
              <input id="name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              {fieldErrors.name && <p className={errorClass}>{fieldErrors.name}</p>}
            </div>

            <div>
              <label className={labelClass}>Mobile / contact numbers</label>
              <div className="mt-1.5 space-y-2">
                {phones.map((p, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      className={inputClass}
                      value={p}
                      onChange={(e) => updatePhone(i, e.target.value)}
                      placeholder="+9715XXXXXXXX"
                      autoComplete={i === 0 ? 'tel' : 'off'}
                    />
                    {phones.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePhone(i)}
                        className="shrink-0 rounded-xl border border-slate-200 px-3 text-slate-500 transition hover:border-red-300 hover:text-red-600"
                        aria-label="Remove number"
                      >
                        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4" aria-hidden>
                          <path d="M5 5l10 10M15 5L5 15" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addPhone}
                className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-orange-600 hover:text-orange-700"
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4" aria-hidden>
                  <path d="M10 4v12M4 10h12" />
                </svg>
                Add another number
              </button>
              {fieldErrors.phones && <p className={errorClass}>{fieldErrors.phones}</p>}
              <p className="mt-1 text-xs text-slate-400">The first number is your primary login mobile.</p>
            </div>

            <div>
              <label className={labelClass} htmlFor="email">Email</label>
              <input id="email" type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              {fieldErrors.email && <p className={errorClass}>{fieldErrors.email}</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="password">Password</label>
                <input id="password" type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
                {fieldErrors.password && <p className={errorClass}>{fieldErrors.password}</p>}
              </div>
              <div>
                <label className={labelClass} htmlFor="confirmPassword">Confirm password</label>
                <input id="confirmPassword" type="password" className={inputClass} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
                {fieldErrors.confirmPassword && <p className={errorClass}>{fieldErrors.confirmPassword}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Step 2 — Company */}
        {step === 1 && (
          <div className="grid gap-4">
            <div>
              <label className={labelClass} htmlFor="companyName">Company name</label>
              <input id="companyName" className={inputClass} value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              {fieldErrors.companyName && <p className={errorClass}>{fieldErrors.companyName}</p>}
            </div>
            <div>
              <label className={labelClass} htmlFor="tradeName">Trade name <span className="text-slate-400">(optional)</span></label>
              <input id="tradeName" className={inputClass} value={tradeName} onChange={(e) => setTradeName(e.target.value)} />
            </div>
            <div>
              <label className={labelClass} htmlFor="tradeLicenseNumber">Trade license number</label>
              <input id="tradeLicenseNumber" className={inputClass} value={tradeLicenseNumber} onChange={(e) => setTradeLicenseNumber(e.target.value)} />
              {fieldErrors.tradeLicenseNumber && <p className={errorClass}>{fieldErrors.tradeLicenseNumber}</p>}
            </div>
            <div>
              <label className={labelClass}>Company type</label>
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
              {fieldErrors.companyType && <p className={errorClass}>{fieldErrors.companyType}</p>}
            </div>
          </div>
        )}

        {/* Step 3 — Location */}
        {step === 2 && (
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="country">Country</label>
                <input id="country" className={inputClass} value={country} onChange={(e) => setCountry(e.target.value)} />
                {fieldErrors.country && <p className={errorClass}>{fieldErrors.country}</p>}
              </div>
              <div>
                <label className={labelClass} htmlFor="emirate">Emirate</label>
                <select id="emirate" className={inputClass} value={emirate} onChange={(e) => setEmirate(e.target.value)}>
                  <option value="">Select emirate…</option>
                  {UAE_EMIRATES.map((em) => (
                    <option key={em} value={em}>{em}</option>
                  ))}
                </select>
                {fieldErrors.emirate && <p className={errorClass}>{fieldErrors.emirate}</p>}
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="city">City</label>
              <input id="city" className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} />
              {fieldErrors.city && <p className={errorClass}>{fieldErrors.city}</p>}
            </div>
            <div>
              <label className={labelClass} htmlFor="address">Address</label>
              <textarea id="address" rows={2} className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} />
              {fieldErrors.address && <p className={errorClass}>{fieldErrors.address}</p>}
            </div>
            <div>
              <label className={labelClass}>Pin your store on the map</label>
              <div className="mt-1.5">
                <MapLocationPicker value={coords} onChange={setCoords} />
              </div>
            </div>
          </div>
        )}

        {/* Step 4 — Categories */}
        {step === 3 && (
          <div className="grid gap-3">
            <p className="text-sm text-slate-500">
              Pick every category you sell in. Tap a main category to expand its
              subcategories — you can select any combination. The first one you
              select becomes your primary category.
            </p>
            <div className="rounded-xl border border-slate-200">
              {categoryTree.map((root, i) => (
                <CategoryTreeRow
                  key={root.id}
                  root={root}
                  isLast={i === categoryTree.length - 1}
                  selected={selectedCategoryIds}
                  onToggle={toggleCategory}
                />
              ))}
            </div>
            {selectedCategoryIds.length > 0 && (
              <p className="text-xs font-medium text-slate-500">
                {selectedCategoryIds.length} selected
              </p>
            )}
            {fieldErrors.categories && <p className={errorClass}>{fieldErrors.categories}</p>}
          </div>
        )}

        {/* Step 5 — Documents & media */}
        {step === 4 && (
          <div className="grid gap-6">
            {/* Required verification docs */}
            <section className="grid gap-3">
              <h3 className="text-sm font-semibold text-slate-800">Verification documents</h3>
              {(['TRADE_LICENSE', 'PASSPORT'] as const).map((type) => {
                const doc = docsByType.get(type)?.[0];
                const isUploading = uploadingType === type;
                return (
                  <div key={type} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {type === 'TRADE_LICENSE' ? 'Trade License' : 'Emirates ID or Passport'}
                          <span className="ml-1 text-red-500">*</span>
                        </p>
                        {doc ? (
                          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-emerald-600 hover:underline">
                            Uploaded — view file
                          </a>
                        ) : (
                          <p className="text-xs text-slate-400">PDF, JPG, PNG or WEBP · Max 20 MB</p>
                        )}
                      </div>
                      <label className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                        {isUploading ? 'Uploading…' : doc ? 'Replace' : 'Upload'}
                        <input
                          type="file"
                          className="hidden"
                          accept={DOC_ACCEPT}
                          disabled={isUploading}
                          onChange={(e) => {
                            if (e.target.files?.length) void handleFiles(type, e.target.files);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </div>
                    {doc && isImageUrl(doc.fileUrl) && (
                      <img src={doc.fileUrl} alt="" className="mt-3 h-24 w-auto rounded-lg border border-slate-100 object-cover" />
                    )}
                    {fieldErrors[type] && <p className={errorClass}>{fieldErrors[type]}</p>}
                  </div>
                );
              })}
            </section>

            {/* Store photos gallery */}
            <GallerySection
              title="Store photos"
              hint={`Upload at least ${MIN_STORE_PHOTOS} photos (max ${DOCUMENT_LIMITS.STORE_PHOTO}).`}
              type="STORE_PHOTO"
              items={docsByType.get('STORE_PHOTO') ?? []}
              limit={DOCUMENT_LIMITS.STORE_PHOTO}
              required
              count={storePhotoCount}
              min={MIN_STORE_PHOTOS}
              uploading={uploadingType === 'STORE_PHOTO'}
              error={fieldErrors.STORE_PHOTO}
              accept={DOC_ACCEPT}
              onFiles={handleFiles}
              onDelete={handleDeleteDoc}
            />

            {/* Warehouse photos gallery */}
            <GallerySection
              title="Warehouse photos"
              hint={`Optional · up to ${DOCUMENT_LIMITS.WAREHOUSE_PHOTO} photos.`}
              type="WAREHOUSE_PHOTO"
              items={docsByType.get('WAREHOUSE_PHOTO') ?? []}
              limit={DOCUMENT_LIMITS.WAREHOUSE_PHOTO}
              uploading={uploadingType === 'WAREHOUSE_PHOTO'}
              error={fieldErrors.WAREHOUSE_PHOTO}
              accept={DOC_ACCEPT}
              onFiles={handleFiles}
              onDelete={handleDeleteDoc}
            />

            {/* Store video */}
            <section className="grid gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Store video</h3>
                <p className="text-xs text-slate-400">Optional · MP4, WEBM or MOV · Max 60 MB</p>
              </div>
              {(() => {
                const video = docsByType.get('STORE_VIDEO')?.[0];
                const isUploading = uploadingType === 'STORE_VIDEO';
                return (
                  <div className="rounded-xl border border-slate-200 p-4">
                    {video ? (
                      <div className="space-y-3">
                        <video src={video.fileUrl} controls className="max-h-56 w-full rounded-lg bg-black" />
                        <button type="button" onClick={() => void handleDeleteDoc(video.id)} className="text-xs font-semibold text-red-600 hover:underline">
                          Remove video
                        </button>
                      </div>
                    ) : (
                      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 py-8 text-center transition hover:border-orange-300 hover:bg-orange-50/40">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-8 w-8 text-slate-400" aria-hidden>
                          <path d="M15 10l4.5-2.5v9L15 14M4 6h11v12H4z" strokeLinejoin="round" />
                        </svg>
                        <span className="text-sm font-medium text-slate-600">
                          {isUploading ? 'Uploading…' : 'Click to upload a store video'}
                        </span>
                        <input type="file" className="hidden" accept={VIDEO_ACCEPT} disabled={isUploading} onChange={(e) => { if (e.target.files?.length) void handleFiles('STORE_VIDEO', e.target.files); e.target.value = ''; }} />
                      </label>
                    )}
                    {fieldErrors.STORE_VIDEO && <p className={errorClass}>{fieldErrors.STORE_VIDEO}</p>}
                  </div>
                );
              })()}
            </section>
          </div>
        )}

        {/* Footer actions */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-6">
          <div className="flex items-center gap-4">
            {step > (accountCreated ? 1 : 0) && (
              <button type="button" onClick={handleBack} disabled={pending} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">
                Back
              </button>
            )}
            {accountCreated && (
              <button type="button" onClick={handleSaveDraft} disabled={pending} className="text-sm font-semibold text-slate-500 transition hover:text-slate-700 disabled:opacity-60">
                {draftSaved ? 'Draft saved ✓' : 'Save draft'}
              </button>
            )}
          </div>

          {step < STEPS.length - 1 ? (
            <button type="button" onClick={handleNext} disabled={pending} className="rounded-xl bg-orange-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 disabled:opacity-60">
              {pending ? 'Saving…' : step === 0 ? 'Create account & continue' : 'Continue'}
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={pending} className="rounded-xl bg-orange-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 disabled:opacity-60">
              {pending ? 'Submitting…' : 'Submit application'}
            </button>
          )}
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link href={`/${locale}/login`} className="font-semibold text-slate-900 hover:text-orange-600">
          Sign in
        </Link>
      </p>
    </div>
  );
}

/* ── Gallery uploader sub-component ───────────────────────────────────── */

type GalleryProps = {
  title: string;
  hint: string;
  type: SupplierDocumentType;
  items: DocItem[];
  limit: number;
  required?: boolean;
  count?: number;
  min?: number;
  uploading: boolean;
  error?: string;
  accept: string;
  onFiles: (type: SupplierDocumentType, files: FileList) => void;
  onDelete: (id: string) => void;
};

function GallerySection({
  title,
  hint,
  type,
  items,
  limit,
  required,
  count,
  min,
  uploading,
  error,
  accept,
  onFiles,
  onDelete,
}: GalleryProps) {
  const atLimit = items.length >= limit;
  const enough = min == null || (count ?? items.length) >= min;
  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">
            {title}
            {required && <span className="ml-1 text-red-500">*</span>}
          </h3>
          <p className="text-xs text-slate-400">{hint}</p>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${enough ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
          {items.length}{min ? ` / ${min}+` : ''} uploaded
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
        {items.map((d) => (
          <div key={d.id} className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            {isImageUrl(d.fileUrl) ? (
              <img src={d.fileUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">File</div>
            )}
            <button
              type="button"
              onClick={() => onDelete(d.id)}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
              aria-label="Remove"
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-3.5 w-3.5" aria-hidden>
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            </button>
          </div>
        ))}

        {!atLimit && (
          <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-200 text-center transition hover:border-orange-300 hover:bg-orange-50/40">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5 text-slate-400" aria-hidden>
              <path d="M10 4v12M4 10h12" />
            </svg>
            <span className="px-1 text-[11px] font-medium text-slate-500">
              {uploading ? 'Uploading…' : 'Add'}
            </span>
            <input
              type="file"
              className="hidden"
              accept={accept}
              multiple
              disabled={uploading}
              onChange={(e) => {
                if (e.target.files?.length) onFiles(type, e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        )}
      </div>
      {error && <p className={errorClass}>{error}</p>}
    </section>
  );
}

/* ── Category tree row (mobile-friendly accordion) ───────────────────── */

type CategoryTreeRowProps = {
  root: WizardCategory & { children: WizardCategory[] };
  isLast: boolean;
  selected: string[];
  onToggle: (id: string) => void;
};

function CategoryTreeRow({ root, isLast, selected, onToggle }: CategoryTreeRowProps) {
  const hasChildren = root.children.length > 0;
  const selectedChildren = root.children.filter((c) => selected.includes(c.id)).length;
  const rootSelected = selected.includes(root.id);
  const [open, setOpen] = useState(selectedChildren > 0);

  return (
    <div className={isLast ? '' : 'border-b border-slate-100'}>
      <div className="flex items-center gap-2 px-2 sm:px-3">
        {/* Tap target for selecting the main category */}
        <label className="flex flex-1 cursor-pointer items-center gap-3 py-3.5">
          <input
            type="checkbox"
            className="h-5 w-5 shrink-0 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
            checked={rootSelected}
            onChange={() => onToggle(root.id)}
          />
          <span className="text-sm font-semibold text-slate-800">{root.name}</span>
          {selectedChildren > 0 && (
            <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-semibold text-orange-600">
              {selectedChildren}
            </span>
          )}
        </label>

        {hasChildren && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
            aria-label={open ? 'Collapse' : 'Expand'}
            aria-expanded={open}
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
              aria-hidden
            >
              <path d="M5 8l5 5 5-5" />
            </svg>
          </button>
        )}
      </div>

      {hasChildren && open && (
        <div className="bg-slate-50/60 pb-1">
          {root.children.map((child) => (
            <label
              key={child.id}
              className="flex cursor-pointer items-center gap-3 py-3 pl-11 pr-3"
            >
              <input
                type="checkbox"
                className="h-5 w-5 shrink-0 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                checked={selected.includes(child.id)}
                onChange={() => onToggle(child.id)}
              />
              <span className="text-sm text-slate-700">{child.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
