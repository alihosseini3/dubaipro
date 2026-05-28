'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

type SignOutButtonProps = {
  locale: string;
  variant?: 'link' | 'button';
  className?: string;
};

export function SignOutButton({ locale, variant = 'link', className }: SignOutButtonProps) {
  const t = useTranslations('auth');
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.push(`/${locale}`);
      router.refresh();
    }
  }

  const base =
    variant === 'button'
      ? 'inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-900 disabled:opacity-50'
      : 'text-sm text-slate-600 transition-colors hover:text-slate-900 disabled:opacity-50';

  return (
    <button type="button" onClick={handleClick} disabled={pending} className={(className ?? '') + ' ' + base}>
      {pending ? t('signingOut') : t('signOut')}
    </button>
  );
}
