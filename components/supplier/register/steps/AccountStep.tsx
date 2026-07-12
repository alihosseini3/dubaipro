'use client';

import { useTranslations } from 'next-intl';

import { ERROR, FIELD, HINT, LABEL } from '../fields';

type Props = {
  name: string;
  onName: (v: string) => void;
  phones: string[];
  onPhones: (v: string[]) => void;
  email: string;
  onEmail: (v: string) => void;
  password: string;
  onPassword: (v: string) => void;
  confirmPassword: string;
  onConfirmPassword: (v: string) => void;
  errors: Record<string, string>;
};

export function AccountStep({
  name,
  onName,
  phones,
  onPhones,
  email,
  onEmail,
  password,
  onPassword,
  confirmPassword,
  onConfirmPassword,
  errors
}: Props) {
  const t = useTranslations('supplierRegister');

  return (
    <div className="grid gap-4">
      <div>
        <label className={LABEL} htmlFor="reg-name">
          {t('fullName')}
        </label>
        <input
          id="reg-name"
          className={`mt-1 ${FIELD}`}
          value={name}
          onChange={(e) => onName(e.target.value)}
          autoComplete="name"
        />
        {errors.name && <p className={ERROR}>{errors.name}</p>}
      </div>

      <div>
        <label className={LABEL}>{t('phones')}</label>
        <div className="mt-1.5 space-y-2">
          {phones.map((phone, i) => (
            <div key={i} className="flex gap-2">
              <input
                className={FIELD}
                value={phone}
                onChange={(e) =>
                  onPhones(phones.map((p, idx) => (idx === i ? e.target.value : p)))
                }
                placeholder="+9715XXXXXXXX"
                autoComplete={i === 0 ? 'tel' : 'off'}
                dir="ltr"
              />
              {phones.length > 1 && (
                <button
                  type="button"
                  onClick={() => onPhones(phones.filter((_, idx) => idx !== i))}
                  className="shrink-0 rounded-xl border border-slate-200 px-3 text-slate-500 transition hover:border-rose-300 hover:text-rose-600 dark:border-slate-600"
                  aria-label={t('removePhone')}
                >
                  <svg
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    className="h-4 w-4"
                    aria-hidden
                  >
                    <path d="M5 5l10 10M15 5L5 15" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onPhones([...phones, ''])}
          className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-orange-600 transition hover:text-orange-700"
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="h-4 w-4"
            aria-hidden
          >
            <path d="M10 4v12M4 10h12" />
          </svg>
          {t('addPhone')}
        </button>
        {errors.phones && <p className={ERROR}>{errors.phones}</p>}
        <p className={`mt-1 ${HINT}`}>{t('phonesHint')}</p>
      </div>

      <div>
        <label className={LABEL} htmlFor="reg-email">
          {t('email')}
        </label>
        <input
          id="reg-email"
          type="email"
          className={`mt-1 ${FIELD}`}
          value={email}
          onChange={(e) => onEmail(e.target.value)}
          autoComplete="email"
          dir="ltr"
        />
        {errors.email && <p className={ERROR}>{errors.email}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={LABEL} htmlFor="reg-password">
            {t('password')}
          </label>
          <input
            id="reg-password"
            type="password"
            className={`mt-1 ${FIELD}`}
            value={password}
            onChange={(e) => onPassword(e.target.value)}
            autoComplete="new-password"
          />
          {errors.password && <p className={ERROR}>{errors.password}</p>}
        </div>
        <div>
          <label className={LABEL} htmlFor="reg-confirm">
            {t('confirmPassword')}
          </label>
          <input
            id="reg-confirm"
            type="password"
            className={`mt-1 ${FIELD}`}
            value={confirmPassword}
            onChange={(e) => onConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
          {errors.confirmPassword && <p className={ERROR}>{errors.confirmPassword}</p>}
        </div>
      </div>
    </div>
  );
}
