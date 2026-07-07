'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { FormMessage, Select, SubmitButton, TextInput } from './AdminForm';

type Props = {
  locale: string;
};

const ROLES = ['ADMIN', 'CUSTOMER', 'SELLER', 'SUPPLIER'] as const;

type FieldErrors = Partial<Record<'name' | 'email' | 'password', string>>;

export function UserCreateForm({ locale }: Props) {
  const t = useTranslations('admin.users');
  const tCommon = useTranslations('admin.common');
  const tRole = useTranslations('auth.role');
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<string>('CUSTOMER');
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const roleOptions = ROLES.map((r) => ({
    value: r,
    label: tRole(r.toLowerCase() as Lowercase<(typeof ROLES)[number]>)
  }));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldErrors({});
    setServerError(null);
    setPending(true);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password, role })
      });

      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        errors?: FieldErrors;
        data?: { id: string };
      };

      if (!res.ok) {
        if (payload.errors) {
          setFieldErrors(payload.errors);
        } else {
          setServerError(payload.error ?? `status ${res.status}`);
        }
        return;
      }

      router.push(`/${locale}/admin/users/${payload.data!.id}`);
      router.refresh();
    } catch {
      setServerError(tCommon('saveFailed'));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {serverError && <FormMessage type="error">{serverError}</FormMessage>}

      <TextInput
        id="create-user-name"
        name="name"
        label={t('fieldName')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={pending}
        autoComplete="name"
        error={fieldErrors.name}
      />

      <TextInput
        id="create-user-email"
        name="email"
        type="email"
        label={t('fieldEmail')}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={pending}
        autoComplete="email"
        error={fieldErrors.email}
      />

      <div>
        <label htmlFor="create-user-password" className="mb-1 block text-sm font-medium text-slate-700">
          {t('fieldPassword')}
        </label>
        <div className="relative">
          <input
            id="create-user-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={pending}
            autoComplete="new-password"
            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-sm shadow-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-50 disabled:text-slate-500"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-700"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
        {fieldErrors.password && <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>}
        {!fieldErrors.password && <p className="mt-1 text-xs text-slate-500">{t('passwordHint')}</p>}
      </div>

      <Select
        name="role"
        label={t('fieldRole')}
        value={role}
        onChange={(e) => setRole(e.target.value)}
        disabled={pending}
        options={roleOptions}
      />

      <div className="flex items-center gap-3 pt-1">
        <SubmitButton
          label={t('createUser')}
          pendingLabel={tCommon('saving')}
          pending={pending}
        />
        <button
          type="button"
          onClick={() => router.back()}
          disabled={pending}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {tCommon('cancel')}
        </button>
      </div>
    </form>
  );
}
