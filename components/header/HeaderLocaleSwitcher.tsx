'use client';

import { useLocale } from 'next-intl';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { routing } from '@/i18n/routing';
import type { Locale } from '@/i18n/routing';

type LocaleMeta = {
  code: Locale;
  /** Native name shown inside dropdown rows. */
  native: string;
  /** Compact code shown on the trigger button. */
  short: string;
  /** Region flag — pure unicode, no extra deps. */
  flag: string;
};

const META: Record<Locale, LocaleMeta> = {
  en: { code: 'en', native: 'English', short: 'EN', flag: '🇺🇸' },
  fa: { code: 'fa', native: 'فارسی', short: 'فا', flag: '🇮🇷' },
  ar: { code: 'ar', native: 'العربية', short: 'عر', flag: '🇸🇦' },
  ur: { code: 'ur', native: 'اردو', short: 'اردو', flag: '🇵🇰' }
};

/** Replace the locale segment without disturbing the rest of the path. */
function swapLocaleInPath(pathname: string, next: Locale): string {
  const segments = pathname.split('/');
  const first = segments[1];
  if (first && (routing.locales as readonly string[]).includes(first)) {
    segments[1] = next;
    return segments.join('/');
  }
  return `/${next}${pathname === '/' ? '' : pathname}`;
}

type Props = {
  /** `dark` = utility/topbar (transparent over dark gradient).
   *  `light` = full-screen drawer (white surface). */
  tone?: 'dark' | 'light';
  size?: 'sm' | 'lg';
};

/**
 * Premium language switcher used in both the dark utility bar and the
 * mobile drawer. Renders a custom dropdown (no native `<select>` so we
 * can show flag + native name) but keeps the implementation small —
 * no portal, no library.
 *
 * Behaviour:
 *   - Switching locales calls `router.replace` inside `useTransition`
 *     so the navigation is non-blocking and the spinner state lives
 *     inside `isPending`.
 *   - The active row is highlighted with an orange accent + check.
 *   - Closes on outside click, on `Escape`, and after picking a row.
 */
export function HeaderLocaleSwitcher({ tone = 'dark', size = 'sm' }: Props) {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const [isPending, setIsPending] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const isLight = tone === 'light';
  const large = size === 'lg';
  const current = META[locale] ?? META.en;

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function pick(next: Locale) {
    setOpen(false);
    if (next === locale) return;
    setIsPending(true);
    const target = swapLocaleInPath(pathname ?? '/', next);
    window.location.href = target;
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Language"
        className={
          isLight
            ? `inline-flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:opacity-60 ${large ? 'min-h-[48px] text-[15px]' : ''}`
            : 'inline-flex h-7 items-center gap-1.5 rounded-md px-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/5 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:opacity-60'
        }
      >
        <span className="text-base leading-none">{current.flag}</span>
        <span className={isLight ? 'flex-1 text-start' : ''}>
          {isLight ? current.native : current.short}
        </span>
        <ChevronDownIcon
          className={`h-3.5 w-3.5 opacity-70 transition ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Language"
          className={`absolute end-0 z-50 mt-2 min-w-[200px] overflow-hidden rounded-xl bg-white p-1 shadow-xl ring-1 ring-black/5 ${
            isLight ? 'start-0' : ''
          }`}
          style={{ animation: 'fadeIn 150ms ease-out' }}
        >
          {routing.locales.map((loc) => {
            const m = META[loc];
            const active = loc === locale;
            return (
              <li key={loc}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => pick(loc)}
                  className={`group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                    active
                      ? 'bg-orange-50 font-semibold text-orange-700'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="text-lg leading-none">{m.flag}</span>
                  <span className="flex-1 text-start">{m.native}</span>
                  {active && (
                    <CheckIcon className="h-4 w-4 text-orange-600" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m5 12 5 5 9-11" />
    </svg>
  );
}
