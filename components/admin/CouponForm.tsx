'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import type {
  CouponAppliesTo,
  CouponDTO,
  CouponInput,
  CouponType
} from '@/types/coupon';

type CouponFormProps = {
  locale: string;
  /** When provided, the form operates in edit mode. */
  initial?: CouponDTO;
};

type Errors = Record<string, string>;

/** YYYY-MM-DDTHH:mm — the format expected by `<input type="datetime-local">`. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/**
 * Unified create/edit form for Coupon (admin only).
 *
 * Server is the source of truth for validation — this component only does
 * lightweight client-side checks to keep the API free of trivial noise.
 */
export function CouponForm({ locale, initial }: CouponFormProps) {
  const t = useTranslations('admin.coupons');
  const router = useRouter();

  const [code, setCode] = useState(initial?.code ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [type, setType] = useState<CouponType>(initial?.type ?? 'PERCENTAGE');
  const [value, setValue] = useState<string>(
    initial ? String(initial.value) : '10'
  );
  const [minOrderAmount, setMinOrderAmount] = useState<string>(
    initial?.minOrderAmount != null ? String(initial.minOrderAmount) : ''
  );
  const [maxDiscount, setMaxDiscount] = useState<string>(
    initial?.maxDiscount != null ? String(initial.maxDiscount) : ''
  );
  const [usageLimit, setUsageLimit] = useState<string>(
    initial?.usageLimit != null ? String(initial.usageLimit) : ''
  );
  const [expiresAt, setExpiresAt] = useState<string>(
    toLocalInput(initial?.expiresAt ?? null)
  );
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  // ---- Marketing engine ----
  const [appliesTo, setAppliesTo] = useState<CouponAppliesTo>(
    initial?.appliesTo ?? 'ALL'
  );
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [productId, setProductId] = useState(initial?.productId ?? '');
  const [targetUserId, setTargetUserId] = useState(initial?.userId ?? '');
  const [firstOrderOnly, setFirstOrderOnly] = useState(
    initial?.firstOrderOnly ?? false
  );
  const [perUserLimit, setPerUserLimit] = useState<string>(
    initial?.perUserLimit != null ? String(initial.perUserLimit) : ''
  );
  const [startAt, setStartAt] = useState<string>(
    toLocalInput(initial?.startAt ?? null)
  );
  const [autoApply, setAutoApply] = useState(initial?.autoApply ?? false);

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

  function optionalNumber(raw: string): number | null {
    if (raw.trim() === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setGeneralError(null);

    const valueNum = Number(value);
    const localErrors: Errors = {};
    if (!code.trim()) localErrors.code = 'required';
    if (!Number.isFinite(valueNum) || valueNum <= 0) {
      localErrors.value = 'invalid';
    } else if (type === 'PERCENTAGE' && valueNum > 100) {
      localErrors.value = 'percentage_out_of_range';
    }
    if (Object.keys(localErrors).length) {
      setErrors(localErrors);
      return;
    }

    const payload: CouponInput = {
      code: code.trim(),
      description: description.trim() || null,
      type,
      value: valueNum,
      minOrderAmount: optionalNumber(minOrderAmount),
      maxDiscount: optionalNumber(maxDiscount),
      usageLimit:
        usageLimit.trim() === ''
          ? null
          : Number.isInteger(Number(usageLimit))
            ? Number(usageLimit)
            : null,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      isActive,
      appliesTo,
      categoryId: appliesTo === 'CATEGORY' ? categoryId.trim() || null : null,
      productId: appliesTo === 'PRODUCT' ? productId.trim() || null : null,
      userId: appliesTo === 'USER' ? targetUserId.trim() || null : null,
      firstOrderOnly,
      perUserLimit:
        perUserLimit.trim() === ''
          ? null
          : Number.isInteger(Number(perUserLimit))
            ? Number(perUserLimit)
            : null,
      startAt: startAt ? new Date(startAt).toISOString() : null,
      autoApply
    };

    setSubmitting(true);
    try {
      const url = initial
        ? `/api/admin/coupons/${initial.id}`
        : '/api/admin/coupons';
      const method = initial ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = (await res.json().catch(() => ({}))) as {
        data?: CouponDTO;
        error?: string;
        message?: string;
        details?: Errors;
      };
      if (!res.ok) {
        if (data.details) setErrors(data.details);
        setGeneralError(
          data.error ? t(`error_${data.error}` as 'errorGeneric') : t('errorGeneric')
        );
        return;
      }
      router.push(`/${locale}/admin/coupons`);
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
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
            {t('fieldCode')}
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              clearError('code');
            }}
            className={
              inputClass(errors.code) + ' font-mono uppercase tracking-wider'
            }
            placeholder="SUMMER20"
            maxLength={32}
            autoComplete="off"
          />
          {errors.code && <FieldError code={errors.code} t={t} />}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
            {t('fieldType')}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <TypeOption
              active={type === 'PERCENTAGE'}
              onClick={() => setType('PERCENTAGE')}
              label={t('typePercentage')}
              hint="%"
            />
            <TypeOption
              active={type === 'FIXED'}
              onClick={() => setType('FIXED')}
              label={t('typeFixed')}
              hint="$"
            />
          </div>
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
            {type === 'PERCENTAGE'
              ? t('fieldValuePercent')
              : t('fieldValueFixed')}
          </label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              clearError('value');
            }}
            className={inputClass(errors.value)}
          />
          {errors.value && <FieldError code={errors.value} t={t} />}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
            {t('fieldMinOrderAmount')}{' '}
            <span className="text-slate-400">({t('optional')})</span>
          </label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={minOrderAmount}
            onChange={(e) => setMinOrderAmount(e.target.value)}
            className={inputClass(undefined)}
            placeholder="0"
          />
        </div>

        {type === 'PERCENTAGE' && (
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              {t('fieldMaxDiscount')}{' '}
              <span className="text-slate-400">({t('optional')})</span>
            </label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={maxDiscount}
              onChange={(e) => setMaxDiscount(e.target.value)}
              className={inputClass(undefined)}
              placeholder={t('fieldMaxDiscountHint')}
            />
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
            {t('fieldUsageLimit')}{' '}
            <span className="text-slate-400">({t('optional')})</span>
          </label>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            value={usageLimit}
            onChange={(e) => setUsageLimit(e.target.value)}
            className={inputClass(undefined)}
            placeholder={t('fieldUsageLimitHint')}
          />
          {initial && initial.usedCount > 0 && (
            <p className="mt-1 text-[11px] text-slate-500">
              {t('usedCountLabel', { count: initial.usedCount })}
            </p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
            {t('fieldExpiresAt')}{' '}
            <span className="text-slate-400">({t('optional')})</span>
          </label>
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className={inputClass(undefined)}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
            {t('fieldStartAt')}{' '}
            <span className="text-slate-400">({t('optional')})</span>
          </label>
          <input
            type="datetime-local"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            className={inputClass(undefined)}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
            {t('fieldPerUserLimit')}{' '}
            <span className="text-slate-400">({t('optional')})</span>
          </label>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            value={perUserLimit}
            onChange={(e) => setPerUserLimit(e.target.value)}
            className={inputClass(undefined)}
            placeholder="1"
          />
        </div>

        {/* ---------- Scope ---------- */}
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
            {t('fieldAppliesTo')}
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(['ALL', 'CATEGORY', 'PRODUCT', 'USER'] as CouponAppliesTo[]).map(
              (s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setAppliesTo(s);
                    clearError('categoryId');
                    clearError('productId');
                    clearError('userId');
                  }}
                  className={
                    'rounded-lg border px-3 py-2 text-xs font-semibold transition ' +
                    (appliesTo === s
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300')
                  }
                  aria-pressed={appliesTo === s}
                >
                  {t(`scope_${s}` as 'scope_ALL')}
                </button>
              )
            )}
          </div>
        </div>

        {appliesTo === 'CATEGORY' && (
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              {t('fieldCategoryId')}
            </label>
            <input
              type="text"
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                clearError('categoryId');
              }}
              className={inputClass(errors.categoryId)}
              placeholder="cat_xxx"
              autoComplete="off"
            />
            {errors.categoryId && <FieldError code={errors.categoryId} t={t} />}
          </div>
        )}
        {appliesTo === 'PRODUCT' && (
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              {t('fieldProductId')}
            </label>
            <input
              type="text"
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value);
                clearError('productId');
              }}
              className={inputClass(errors.productId)}
              placeholder="prod_xxx"
              autoComplete="off"
            />
            {errors.productId && <FieldError code={errors.productId} t={t} />}
          </div>
        )}
        {appliesTo === 'USER' && (
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              {t('fieldUserId')}
            </label>
            <input
              type="text"
              value={targetUserId}
              onChange={(e) => {
                setTargetUserId(e.target.value);
                clearError('userId');
              }}
              className={inputClass(errors.userId)}
              placeholder="user_xxx"
              autoComplete="off"
            />
            {errors.userId && <FieldError code={errors.userId} t={t} />}
          </div>
        )}

        {/* ---------- Toggles ---------- */}
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <input
            type="checkbox"
            checked={firstOrderOnly}
            onChange={(e) => setFirstOrderOnly(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-slate-900"
          />
          <div className="text-sm">
            <div className="font-semibold text-slate-900">
              {t('fieldFirstOrderOnly')}
            </div>
            <div className="text-xs text-slate-500">
              {t('fieldFirstOrderOnlyHint')}
            </div>
          </div>
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <input
            type="checkbox"
            checked={autoApply}
            onChange={(e) => setAutoApply(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-slate-900"
          />
          <div className="text-sm">
            <div className="font-semibold text-slate-900">
              {t('fieldAutoApply')}
            </div>
            <div className="text-xs text-slate-500">
              {t('fieldAutoApplyHint')}
            </div>
          </div>
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
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
          onClick={() => router.push(`/${locale}/admin/coupons`)}
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

function TypeOption({
  active,
  onClick,
  label,
  hint
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-semibold transition ' +
        (active
          ? 'border-slate-900 bg-slate-900 text-white'
          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300')
      }
      aria-pressed={active}
    >
      <span>{label}</span>
      <span
        className={
          'font-mono text-base ' + (active ? 'text-white/70' : 'text-slate-400')
        }
      >
        {hint}
      </span>
    </button>
  );
}
