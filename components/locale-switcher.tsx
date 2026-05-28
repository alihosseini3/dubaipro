'use client';

import { useLocale } from 'next-intl';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import type { ChangeEvent } from 'react';

import { routing } from '@/i18n/routing';
import type { Locale } from '@/i18n/routing';

const localeLabels: Record<Locale, string> = {
  en: 'EN',
  fa: 'فا',
  ar: 'عر',
  ur: 'اردو'
};

function swapLocaleInPath(pathname: string, nextLocale: Locale): string {
  const segments = pathname.split('/');
  const first = segments[1];

  if (first && (routing.locales as readonly string[]).includes(first)) {
    segments[1] = nextLocale;
    return segments.join('/');
  }

  return `/${nextLocale}${pathname === '/' ? '' : pathname}`;
}

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const [isPending, setIsPending] = useState(false);

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextLocale = event.target.value as Locale;
    const target = swapLocaleInPath(pathname, nextLocale);
    setIsPending(true);
    window.location.href = target;
  }

  return (
    <select
      value={locale}
      onChange={handleChange}
      disabled={isPending}
      className="cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {routing.locales.map((loc) => (
        <option key={loc} value={loc}>
          {localeLabels[loc]}
        </option>
      ))}
    </select>
  );
}
