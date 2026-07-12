'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { CompanyType, SupplierDocumentType } from '@prisma/client';

import {
  DEFAULT_COUNTRY,
  DOCUMENT_LIMITS,
  EMAIL_RE,
  MAX_DOCUMENT_BYTES,
  MAX_VIDEO_BYTES,
  MIN_STORE_PHOTOS,
  REQUIRED_DOCUMENT_TYPES,
  isAllowedDocumentMime,
  isAllowedVideoMime,
  isStrongPassword,
  isValidPhone,
  type SupplierRegisterPayload,
  type SupplierRegistrationState
} from '@/lib/supplier/registration';

import { CARD } from './fields';
import { AccountStep } from './steps/AccountStep';
import { CompanyStep } from './steps/CompanyStep';
import { LocationStep } from './steps/LocationStep';
import { CategoriesStep, type WizardCategory } from './steps/CategoriesStep';
import { DocumentsStep, type DocItem } from './steps/DocumentsStep';

export type { WizardCategory };

type Props = {
  locale: string;
  categories: WizardCategory[];
  isAuthenticated: boolean;
  initialState: SupplierRegistrationState | null;
};

type FieldErrors = Record<string, string>;

const STEP_KEYS = ['Account', 'Company', 'Location', 'Categories', 'Documents'] as const;

/**
 * Supplier registration wizard.
 *
 * Rebuilt from the old 1054-line monolith: split per step, fully translated
 * (`supplierRegister` namespace — it used to be the only supplier surface with
 * hardcoded English, even for RTL locales), dark-mode aware, and using logical
 * CSS properties so ar/fa/ur lay out right-to-left correctly.
 *
 * Each "Continue" persists that step's slice, so a half-finished application
 * is resumable. Publishing products is gated on admin approval
 * (lib/suppliers/gating.ts) — the success screen sets that expectation.
 */
export function RegisterWizard({
  locale,
  categories,
  isAuthenticated,
  initialState
}: Props) {
  const t = useTranslations('supplierRegister');

  const [step, setStep] = useState(isAuthenticated ? 1 : 0);
  const [maxReached, setMaxReached] = useState(isAuthenticated ? 1 : 0);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(
    initialState?.onboardingStatus === 'PENDING'
  );
  const [accountCreated, setAccountCreated] = useState(isAuthenticated);
  const [draftSaved, setDraftSaved] = useState(false);

  const topRef = useRef<HTMLDivElement>(null);

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

  // Step 4 — categories (first selected id = primary)
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(() => {
    if (!initialState) return [];
    return [
      ...(initialState.primaryCategoryId ? [initialState.primaryCategoryId] : []),
      ...initialState.secondaryCategoryIds
    ].filter((v, i, arr) => arr.indexOf(v) === i);
  });

  // Step 5 — documents
  const [documents, setDocuments] = useState<DocItem[]>(initialState?.documents ?? []);
  const [uploadingType, setUploadingType] = useState<SupplierDocumentType | null>(null);

  const storePhotoCount = documents.filter((d) => d.type === 'STORE_PHOTO').length;

  function scrollTop() {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function clearErrors() {
    setFormError(null);
    setErrors({});
  }

  async function postPayload(
    payload: SupplierRegisterPayload
  ): Promise<SupplierRegistrationState | null> {
    const res = await fetch('/api/supplier/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = (await res.json().catch(() => ({}))) as {
      data?: SupplierRegistrationState;
      error?: string;
      details?: FieldErrors;
    };
    if (!res.ok) {
      if (json.details) setErrors(json.details);
      throw new Error(json.error ?? t('errGeneric'));
    }
    return json.data ?? null;
  }

  /* ── validation ─────────────────────────────────────────────────────── */

  function validateStep(target: number): FieldErrors {
    const e: FieldErrors = {};
    if (target === 0) {
      if (!name.trim()) e.name = t('errNameRequired');
      if (!EMAIL_RE.test(email.trim())) e.email = t('errEmailInvalid');
      const cleaned = phones.map((p) => p.trim()).filter(Boolean);
      if (cleaned.length === 0) e.phones = t('errPhoneRequired');
      else if (!cleaned.every((p) => isValidPhone(p))) e.phones = t('errPhoneInvalid');
      if (!isStrongPassword(password)) e.password = t('errPasswordWeak');
      if (password !== confirmPassword) e.confirmPassword = t('errPasswordMismatch');
    } else if (target === 1) {
      if (!companyName.trim()) e.companyName = t('errCompanyName');
      if (!tradeLicenseNumber.trim()) e.tradeLicenseNumber = t('errTradeLicense');
      if (!companyType) e.companyType = t('errCompanyType');
    } else if (target === 2) {
      if (!country.trim()) e.country = t('errCountry');
      if (!emirate.trim()) e.emirate = t('errEmirate');
      if (!city.trim()) e.city = t('errCity');
      if (!address.trim()) e.address = t('errAddress');
    } else if (target === 3) {
      if (selectedCategoryIds.length === 0) e.categories = t('errCategories');
    }
    return e;
  }

  function payloadForStep(target: number): SupplierRegisterPayload {
    switch (target) {
      case 0:
        return {
          account: {
            name: name.trim(),
            email: email.trim(),
            phones: phones.map((p) => p.trim()).filter(Boolean),
            password
          }
        };
      case 1:
        return {
          company: {
            companyName: companyName.trim(),
            tradeName: tradeName.trim() || null,
            tradeLicenseNumber: tradeLicenseNumber.trim(),
            companyType: companyType as CompanyType
          }
        };
      case 2:
        return {
          location: {
            country: country.trim(),
            emirate: emirate.trim(),
            city: city.trim(),
            address: address.trim(),
            latitude: coords?.lat ?? null,
            longitude: coords?.lng ?? null
          }
        };
      case 3:
        return {
          categories: {
            primaryCategoryId: selectedCategoryIds[0] ?? '',
            secondaryCategoryIds: selectedCategoryIds.slice(1)
          }
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
        ...state.secondaryCategoryIds
      ].filter((v, i, arr) => arr.indexOf(v) === i)
    );
  }

  /* ── navigation ─────────────────────────────────────────────────────── */

  async function handleNext() {
    clearErrors();
    const errs = validateStep(step);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setPending(true);
    try {
      const state = await postPayload(payloadForStep(step));
      if (step === 0) setAccountCreated(true);
      if (state) syncFromState(state);
      const next = Math.min(step + 1, STEP_KEYS.length - 1);
      setStep(next);
      setMaxReached((m) => Math.max(m, next));
      scrollTop();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('errGeneric'));
    } finally {
      setPending(false);
    }
  }

  function goToStep(target: number) {
    if (target > maxReached) return;
    if (accountCreated && target === 0) return; // account is done, can't redo it
    clearErrors();
    setStep(target);
    scrollTop();
  }

  async function handleSaveDraft() {
    clearErrors();
    if (!accountCreated) {
      setFormError(t('errAccountFirst'));
      return;
    }
    setPending(true);
    try {
      await postPayload(payloadForStep(step));
      setDraftSaved(true);
      window.setTimeout(() => setDraftSaved(false), 2500);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('errGeneric'));
    } finally {
      setPending(false);
    }
  }

  /* ── uploads ────────────────────────────────────────────────────────── */

  async function uploadOne(type: SupplierDocumentType, file: File): Promise<DocItem> {
    const isVideo = type === 'STORE_VIDEO';
    const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_DOCUMENT_BYTES;
    if (file.size > maxBytes) {
      throw new Error(t('errFileTooLarge', { mb: Math.round(maxBytes / 1024 / 1024) }));
    }
    const mimeOk = isVideo
      ? isAllowedVideoMime(file.type)
      : isAllowedDocumentMime(file.type);
    if (!mimeOk) {
      throw new Error(isVideo ? t('errVideoMime') : t('errDocMime'));
    }

    const fd = new FormData();
    fd.append('file', file);
    fd.append('type', type);
    const res = await fetch('/api/supplier/upload', { method: 'POST', body: fd });
    const json = (await res.json().catch(() => ({}))) as {
      data?: DocItem;
      error?: string;
    };
    if (!res.ok || !json.data) throw new Error(json.error ?? t('errUploadFailed'));
    return json.data;
  }

  async function handleFiles(type: SupplierDocumentType, files: FileList) {
    clearErrors();
    setUploadingType(type);
    const isGallery = type === 'STORE_PHOTO' || type === 'WAREHOUSE_PHOTO';
    try {
      for (const file of Array.from(files)) {
        const current = documents.filter((d) => d.type === type).length;
        if (isGallery && current >= DOCUMENT_LIMITS[type]) {
          setErrors({ [type]: t('errMaxFiles', { max: DOCUMENT_LIMITS[type] }) });
          break;
        }
        // eslint-disable-next-line no-await-in-loop
        const uploaded = await uploadOne(type, file);
        setDocuments((prev) =>
          isGallery
            ? [...prev, uploaded]
            : [...prev.filter((d) => d.type !== type), uploaded]
        );
      }
    } catch (err) {
      setErrors({ [type]: err instanceof Error ? err.message : t('errUploadFailed') });
    } finally {
      setUploadingType(null);
    }
  }

  async function handleDeleteDoc(id: string) {
    clearErrors();
    try {
      const res = await fetch(`/api/supplier/upload?id=${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? t('errDeleteFailed'));
      }
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('errDeleteFailed'));
    }
  }

  async function handleSubmit() {
    clearErrors();
    const missing = REQUIRED_DOCUMENT_TYPES.filter(
      (type) => !documents.some((d) => d.type === type)
    );
    if (missing.length > 0) {
      setFormError(t('errMissingDocs'));
      return;
    }
    if (storePhotoCount < MIN_STORE_PHOTOS) {
      setFormError(
        t('errMinStorePhotos', { min: MIN_STORE_PHOTOS, count: storePhotoCount })
      );
      return;
    }
    setPending(true);
    try {
      const state = await postPayload({ submit: true });
      if (state) syncFromState(state);
      setSubmitted(true);
      scrollTop();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('errGeneric'));
    } finally {
      setPending(false);
    }
  }

  /* ── success ────────────────────────────────────────────────────────── */

  if (submitted) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-8 w-8"
              aria-hidden
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="mt-6 text-2xl font-bold text-slate-900 dark:text-white">
            {t('successTitle')}
          </h1>
          <p className="mt-3 text-slate-600 dark:text-slate-300">{t('successBody')}</p>
        </div>

        {/* What happens next — the old screen was a dead end. */}
        <ol className="mt-8 space-y-3">
          {[t('successStep1'), t('successStep2'), t('successStep3')].map((line, i) => (
            <li
              key={i}
              className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200"
            >
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700">
                {i + 1}
              </span>
              {line}
            </li>
          ))}
        </ol>

        <div className="mt-8 flex justify-center gap-3">
          <Link
            href={`/${locale}/supplier`}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            {t('goToDashboard')}
          </Link>
          <Link
            href={`/${locale}`}
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200"
          >
            {t('backHome')}
          </Link>
        </div>
      </div>
    );
  }

  /* ── wizard ─────────────────────────────────────────────────────────── */

  const isLastStep = step === STEP_KEYS.length - 1;

  return (
    <div ref={topRef} className="mx-auto w-full max-w-4xl px-4 py-10">
      {/* Header */}
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-lg sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-400">
          {t('eyebrow')}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
          {t('title')}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-slate-300">{t('subtitle')}</p>
      </div>

      {/* Stepper */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
        <ol className="flex items-center">
          {STEP_KEYS.map((key, i) => {
            const done = i < step;
            const active = i === step;
            const clickable = i <= maxReached && !(accountCreated && i === 0);
            return (
              <li key={key} className="flex flex-1 items-center last:flex-none">
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
                          : 'bg-slate-100 text-slate-400 dark:bg-slate-700'
                    }`}
                  >
                    {done ? (
                      <svg
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4"
                        aria-hidden
                      >
                        <path d="M4 10l4 4 8-8" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span className="hidden text-start sm:block">
                    <span
                      className={`block text-sm font-semibold ${
                        active
                          ? 'text-slate-900 dark:text-white'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {t(`step${key}` as Parameters<typeof t>[0])}
                    </span>
                  </span>
                </button>
                {i < STEP_KEYS.length - 1 && (
                  <span
                    className={`mx-2 h-0.5 flex-1 rounded ${
                      i < step ? 'bg-orange-500' : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {/* Card */}
      <div className={`mt-6 ${CARD}`}>
        <div className="mb-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {t(`step${STEP_KEYS[step]}` as Parameters<typeof t>[0])}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t(`step${STEP_KEYS[step]}Desc` as Parameters<typeof t>[0])}
          </p>
        </div>

        {formError && (
          <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {formError}
          </div>
        )}

        {step === 0 && (
          <AccountStep
            name={name}
            onName={setName}
            phones={phones}
            onPhones={setPhones}
            email={email}
            onEmail={setEmail}
            password={password}
            onPassword={setPassword}
            confirmPassword={confirmPassword}
            onConfirmPassword={setConfirmPassword}
            errors={errors}
          />
        )}
        {step === 1 && (
          <CompanyStep
            companyName={companyName}
            onCompanyName={setCompanyName}
            tradeName={tradeName}
            onTradeName={setTradeName}
            tradeLicenseNumber={tradeLicenseNumber}
            onTradeLicenseNumber={setTradeLicenseNumber}
            companyType={companyType}
            onCompanyType={setCompanyType}
            errors={errors}
          />
        )}
        {step === 2 && (
          <LocationStep
            country={country}
            onCountry={setCountry}
            emirate={emirate}
            onEmirate={setEmirate}
            city={city}
            onCity={setCity}
            address={address}
            onAddress={setAddress}
            coords={coords}
            onCoords={setCoords}
            errors={errors}
          />
        )}
        {step === 3 && (
          <CategoriesStep
            categories={categories}
            selected={selectedCategoryIds}
            onToggle={(id) =>
              setSelectedCategoryIds((prev) =>
                prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
              )
            }
            errors={errors}
          />
        )}
        {step === 4 && (
          <DocumentsStep
            documents={documents}
            uploadingType={uploadingType}
            onFiles={handleFiles}
            onDelete={handleDeleteDoc}
            errors={errors}
          />
        )}

        {/* Footer actions */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-6 dark:border-slate-700">
          <div className="flex items-center gap-4">
            {step > (accountCreated ? 1 : 0) && (
              <button
                type="button"
                onClick={() => goToStep(step - 1)}
                disabled={pending}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:text-slate-200"
              >
                {t('back')}
              </button>
            )}
            {accountCreated && (
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={pending}
                className="text-sm font-semibold text-slate-500 transition hover:text-slate-700 disabled:opacity-60"
              >
                {draftSaved ? t('draftSaved') : t('saveDraft')}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={isLastStep ? handleSubmit : handleNext}
            disabled={pending}
            className="rounded-xl bg-orange-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 disabled:opacity-60"
          >
            {pending
              ? isLastStep
                ? t('submitting')
                : t('saving')
              : isLastStep
                ? t('submitApplication')
                : step === 0
                  ? t('createAccount')
                  : t('continue')}
          </button>
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-slate-500">
        {t('alreadyHaveAccount')}{' '}
        <Link
          href={`/${locale}/login`}
          className="font-semibold text-slate-900 transition hover:text-orange-600 dark:text-white"
        >
          {t('signIn')}
        </Link>
      </p>
    </div>
  );
}
