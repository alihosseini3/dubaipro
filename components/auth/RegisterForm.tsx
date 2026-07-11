'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

type RegisterFormProps = {
  locale: string;
};

type SignupRole = 'CUSTOMER' | 'SUPPLIER';

/**
 * Compute a 0-4 password strength score.
 *
 * Each bucket adds one point: length ≥ 8, length ≥ 12, has digit+letter,
 * has mixed case, has symbol. The score is capped at 4 so it aligns with
 * the 4-segment meter UI. This is intentionally simple — no zxcvbn
 * dependency — because it is purely advisory; the server is the source
 * of truth for length validation.
 */
function scorePassword(pw: string): 0 | 1 | 2 | 3 | 4 {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[0-9]/.test(pw) && /[a-zA-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  return Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
}

export function RegisterForm({ locale }: RegisterFormProps) {
  const t = useTranslations('auth');
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<SignupRole>('CUSTOMER');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const strength = useMemo(() => scorePassword(password), [password]);
  const strengthMeta = [
    { label: '', color: 'bg-slate-200', text: 'text-slate-400' },
    { label: t('strengthWeak'), color: 'bg-red-500', text: 'text-red-600' },
    { label: t('strengthFair'), color: 'bg-amber-500', text: 'text-amber-600' },
    { label: t('strengthGood'), color: 'bg-lime-500', text: 'text-lime-700' },
    {
      label: t('strengthStrong'),
      color: 'bg-emerald-500',
      text: 'text-emerald-600'
    }
  ][strength];

  const passwordsMatch =
    password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    if (!name.trim() || !email.trim() || !password) {
      setError(t('errorRequired'));
      return;
    }
    if (password.length < 8) {
      setFieldErrors({ password: t('errorPasswordShort') });
      return;
    }
    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: t('errorPasswordMismatch') });
      return;
    }

    setPending(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          role
        })
      });

      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        details?: Record<string, string>;
      };

      if (!res.ok) {
        if (payload.details) setFieldErrors(payload.details);
        throw new Error(payload.error ?? t('errorGeneric'));
      }

      router.push(`/${locale}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setPending(false);
    }
  }

  const inputClass =
    'block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500';

  const roleOptions: {
    value: SignupRole;
    label: string;
    desc: string;
    icon: React.ReactNode;
  }[] = [
    {
      value: 'CUSTOMER',
      label: t('roleCustomer'),
      desc: t('roleCustomerDesc'),
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
          aria-hidden
        >
          <path d="M6 2l-1 4h14l-1-4M3 6h18l-2 13a2 2 0 01-2 2H7a2 2 0 01-2-2L3 6zM9 10v4m6-4v4" />
        </svg>
      )
    },
    {
      value: 'SUPPLIER',
      label: t('roleSupplier'),
      desc: t('roleSupplierDesc'),
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
          aria-hidden
        >
          <path d="M3 9h13v8H3zM16 12h4l2 3v2h-6M6 21a2 2 0 100-4 2 2 0 000 4zM18 21a2 2 0 100-4 2 2 0 000 4z" />
        </svg>
      )
    }
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="mt-0.5 h-4 w-4 flex-none"
            aria-hidden
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 10-2 0v4a1 1 0 102 0V6zm-1 8a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* ===== Role selector ===== */}
      <fieldset>
        <legend className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-600">
          {t('roleSectionTitle')}
        </legend>
        <div
          role="radiogroup"
          aria-label={t('roleSectionTitle')}
          className="grid grid-cols-1 gap-2 sm:grid-cols-3"
        >
          {roleOptions.map((opt) => {
            const selected = role === opt.value;
            return (
              <label
                key={opt.value}
                className={`group relative flex cursor-pointer flex-col gap-1.5 rounded-xl border p-3 transition ${
                  selected
                    ? 'border-orange-500 bg-orange-50/60 ring-2 ring-orange-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                } ${pending ? 'pointer-events-none opacity-60' : ''}`}
              >
                <input
                  type="radio"
                  name="role"
                  value={opt.value}
                  checked={selected}
                  onChange={() => setRole(opt.value)}
                  className="sr-only"
                  disabled={pending}
                />
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition ${
                      selected
                        ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-sm shadow-orange-900/20'
                        : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                    }`}
                  >
                    {opt.icon}
                  </span>
                  {selected && (
                    <svg
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-4 w-4 text-orange-600"
                      aria-hidden
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 111.42-1.42l2.79 2.79 6.79-6.79a1 1 0 011.42 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <div>
                  <span
                    className={`block text-sm font-semibold ${
                      selected ? 'text-orange-700' : 'text-slate-900'
                    }`}
                  >
                    {opt.label}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
                    {opt.desc}
                  </span>
                </div>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* ===== Name ===== */}
      <div>
        <label
          htmlFor="name"
          className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600"
        >
          {t('name')}
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          disabled={pending}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
        {fieldErrors.name && (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>
        )}
      </div>

      {/* ===== Email ===== */}
      <div>
        <label
          htmlFor="email"
          className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600"
        >
          {t('email')}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={pending}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          placeholder="you@example.com"
        />
        {fieldErrors.email && (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
        )}
      </div>

      {/* ===== Password ===== */}
      <div>
        <label
          htmlFor="password"
          className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600"
        >
          {t('password')}
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            disabled={pending}
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${inputClass} pe-12`}
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            disabled={pending}
            aria-label={showPassword ? t('hidePassword') : t('showPassword')}
            aria-pressed={showPassword}
            className="absolute inset-y-0 end-0 flex items-center px-3 text-slate-400 transition hover:text-slate-700 focus:outline-none focus-visible:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {showPassword ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden
              >
                <path d="M17.94 17.94A10.94 10.94 0 0112 20c-7 0-11-8-11-8a21.77 21.77 0 015.17-6.06" />
                <path d="M9.9 4.24A10.94 10.94 0 0112 4c7 0 11 8 11 8a21.77 21.77 0 01-3.17 4.18" />
                <path d="M14.12 14.12a3 3 0 11-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>

        {/* Strength meter */}
        {password.length > 0 && (
          <div className="mt-2">
            <div className="flex items-center gap-1.5" aria-hidden>
              {[1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                    i <= strength ? strengthMeta.color : 'bg-slate-100'
                  }`}
                />
              ))}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">{t('passwordStrength')}</span>
              <span className={`font-semibold ${strengthMeta.text}`}>
                {strengthMeta.label}
              </span>
            </div>
          </div>
        )}
        {password.length === 0 && (
          <p className="mt-1 text-[11px] text-slate-500">{t('passwordHint')}</p>
        )}
        {fieldErrors.password && (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>
        )}
      </div>

      {/* ===== Confirm password ===== */}
      <div>
        <label
          htmlFor="confirmPassword"
          className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600"
        >
          {t('confirmPassword')}
        </label>
        <div className="relative">
          <input
            id="confirmPassword"
            name="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            disabled={pending}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={`${inputClass} pe-10 ${
              confirmPassword.length > 0 && !passwordsMatch
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500/15'
                : ''
            }`}
            placeholder="••••••••"
          />
          {passwordsMatch && (
            <span
              className="pointer-events-none absolute inset-y-0 end-0 flex items-center px-3 text-emerald-500"
              aria-hidden
            >
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-5 w-5"
              >
                <path
                  fillRule="evenodd"
                  d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 111.42-1.42l2.79 2.79 6.79-6.79a1 1 0 011.42 0z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          )}
        </div>
        {passwordsMatch && (
          <p className="mt-1 text-[11px] font-medium text-emerald-600">
            ✓ {t('passwordsMatch')}
          </p>
        )}
        {fieldErrors.confirmPassword && (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.confirmPassword}</p>
        )}
      </div>

      {/* ===== CTA ===== */}
      <button
        type="submit"
        disabled={pending}
        className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-900/20 transition hover:from-orange-600 hover:to-orange-700 hover:shadow-xl hover:shadow-orange-900/25 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-500/30 disabled:cursor-not-allowed disabled:from-slate-400 disabled:to-slate-400 disabled:shadow-none"
      >
        {pending ? (
          <svg
            className="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeOpacity="0.25"
              strokeWidth="4"
            />
            <path
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
            aria-hidden
          >
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        )}
        <span>{pending ? t('creatingAccount') : t('createAccount')}</span>
      </button>

      {/* ===== Terms ===== */}
      <p className="text-center text-[11px] leading-relaxed text-slate-500">
        {t('termsAgree')}
      </p>

      {/* ===== Trust row ===== */}
      <div className="flex items-center justify-center gap-4 border-t border-slate-100 pt-4 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5 text-emerald-500"
            aria-hidden
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          {t('trustSecure')}
        </span>
        <span className="h-3 w-px bg-slate-200" aria-hidden />
        <span className="inline-flex items-center gap-1">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5 text-emerald-500"
            aria-hidden
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
          {t('trustTrusted')}
        </span>
        <span className="h-3 w-px bg-slate-200" aria-hidden />
        <span className="inline-flex items-center gap-1">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5 text-emerald-500"
            aria-hidden
          >
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          {t('trustEncrypted')}
        </span>
      </div>
    </form>
  );
}
