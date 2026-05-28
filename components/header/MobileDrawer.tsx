'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import type { Currency } from '@/types/currency';

import { CurrencySwitcher } from './CurrencySwitcher';
import { HeaderLocaleSwitcher } from './HeaderLocaleSwitcher';

type NavLink = { href: string; label: string };
type Category = { id: string; name: string; slug: string };

type Props = {
  locale: string;
  navLinks: NavLink[];
  categories: Category[];
  logoUrl?: string | null;
  logoText: string;
  currency: Currency;
  /** Style of the trigger hamburger button. The drawer panel itself
   *  always uses a dark header with light body for readability. */
  tone?: 'dark' | 'light';
  user: { name: string; email: string } | null;
  labels: {
    open: string;
    close: string;
    navigation?: string;
    categories: string;
    language?: string;
    currency?: string;
    signIn: string;
    register: string;
    logout: string;
    account: string;
  };
};

/**
 * Full-screen mobile drawer.
 *
 *  - Header: dark `#0F172A` to mirror the desktop header so the
 *    drawer feels like an extension of the same shell.
 *  - Body : light surface with grouped sections (user / nav /
 *    categories / language / currency).
 *  - Slides in from the page start edge (`start-0`) so RTL is free.
 *  - Locks body scroll while open and closes on Escape / backdrop.
 */
export function MobileDrawer({
  locale,
  navLinks,
  categories,
  logoUrl,
  logoText,
  currency,
  tone = 'dark',
  user,
  labels
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const isLight = tone === 'light';

  // Portal target is only available on the client. Track mount so we
  // don't try to `createPortal` during SSR.
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  function close() {
    setOpen(false);
  }

  async function logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      close();
      router.push(`/${locale}`);
      router.refresh();
    }
  }

  const base = `/${locale}`;

  return (
    <>
      <button
        type="button"
        aria-label={labels.open}
        onClick={() => setOpen(true)}
        className={`inline-flex h-11 w-11 min-h-[44px] items-center justify-center rounded-xl transition focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${
          isLight
            ? 'text-slate-700 hover:bg-slate-100'
            : 'text-white/90 hover:bg-white/10'
        }`}
      >
        <MenuIcon className="h-6 w-6" />
      </button>

      {open && mounted && createPortal(
        <div className="fixed inset-0 z-[100] md:hidden" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <button
            type="button"
            aria-label={labels.close}
            onClick={close}
            className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm"
            style={{ animation: 'fadeIn 150ms ease-out' }}
          />
          {/* Panel */}
          <aside
            className="absolute inset-0 start-0 flex h-full w-full max-w-[420px] flex-col overflow-hidden bg-white shadow-2xl"
            style={{ animation: 'slideInStart 240ms cubic-bezier(0.22, 1, 0.36, 1)' }}
          >
            {/* Dark header to match desktop palette */}
            <header className="flex min-h-[60px] items-center justify-between bg-[#0F172A] px-4 text-white">
              <Link
                href={base}
                onClick={close}
                className="flex min-w-0 items-center gap-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
              >
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt={logoText}
                    className="h-8 w-auto max-w-[140px] object-contain"
                  />
                ) : (
                  <>
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 text-sm font-black text-white shadow-[0_4px_12px_rgba(249,115,22,0.35)]">
                      {logoText.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="truncate text-base font-bold tracking-tight text-white">
                      {logoText}
                    </span>
                  </>
                )}
              </Link>
              <button
                type="button"
                aria-label={labels.close}
                onClick={close}
                className="inline-flex h-11 w-11 min-h-[44px] items-center justify-center rounded-xl text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto bg-slate-50">
              {/* User section */}
              <section className="border-b border-slate-200 bg-white px-4 py-5">
                {user ? (
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-base font-bold text-white">
                      {user.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold text-slate-900">
                        {user.name}
                      </p>
                      <p className="truncate text-sm text-slate-500">{user.email}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                      <UserIcon className="h-6 w-6" />
                    </span>
                    <p className="text-sm font-medium text-slate-700">
                      {labels.signIn}
                      <span className="px-1 text-slate-300">/</span>
                      {labels.register}
                    </p>
                  </div>
                )}

                {user ? (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Link
                      href={`${base}/account`}
                      onClick={close}
                      className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      {labels.account}
                    </Link>
                    <button
                      type="button"
                      onClick={logout}
                      className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-50"
                    >
                      {labels.logout}
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Link
                      href={`${base}/login`}
                      onClick={close}
                      className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      {labels.signIn}
                    </Link>
                    <Link
                      href={`${base}/register`}
                      onClick={close}
                      className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#0F172A] px-4 text-sm font-semibold text-white transition hover:bg-[#1e293b]"
                    >
                      {labels.register}
                    </Link>
                  </div>
                )}
              </section>

              {/* Navigation */}
              {navLinks.length > 0 && (
                <Section title={labels.navigation ?? 'Navigation'}>
                  <ul className="divide-y divide-slate-100">
                    {navLinks.map((l) => (
                      <li key={l.href}>
                        <Link
                          href={l.href}
                          onClick={close}
                          className="group flex min-h-[56px] items-center gap-3 px-4 text-[15px] font-semibold text-slate-800 transition active:bg-slate-100 hover:bg-orange-50 hover:text-orange-700"
                        >
                          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition group-hover:bg-orange-100 group-hover:text-orange-600">
                            <LinkIcon className="h-4 w-4" />
                          </span>
                          <span className="flex-1 truncate">{l.label}</span>
                          <ChevronEndIcon className="h-4 w-4 text-slate-300 transition group-hover:text-orange-500" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {/* Categories */}
              {categories.length > 0 && (
                <Section title={labels.categories}>
                  <ul className="divide-y divide-slate-100">
                    {categories.map((c, idx) => (
                      <li key={c.id}>
                        <Link
                          href={`${base}/categories/${c.slug}`}
                          onClick={close}
                          className="group flex min-h-[56px] items-center gap-3 px-4 text-[15px] text-slate-700 transition active:bg-slate-100 hover:bg-orange-50 hover:text-orange-700"
                        >
                          <span
                            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold transition ${
                              ACCENTS[idx % ACCENTS.length]
                            } group-hover:bg-orange-100 group-hover:text-orange-700`}
                          >
                            {c.name.slice(0, 1).toUpperCase()}
                          </span>
                          <span className="flex-1 truncate font-medium">
                            {c.name}
                          </span>
                          <ChevronEndIcon className="h-4 w-4 text-slate-300 transition group-hover:text-orange-500" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {/* Switchers */}
              <Section
                title={`${labels.language ?? 'Language'} · ${labels.currency ?? 'Currency'}`}
              >
                <div className="grid grid-cols-1 gap-3 px-4 pb-5 sm:grid-cols-2">
                  <HeaderLocaleSwitcher tone="light" size="lg" />
                  <CurrencySwitcher value={currency} tone="light" size="lg" />
                </div>
              </Section>

              <div className="px-4 py-6 text-center text-[11px] text-slate-400">
                {logoText}
              </div>
            </div>
          </aside>
        </div>,
        document.body
      )}
    </>
  );
}

/** Soft pastel chips so the category list scans visually without
 *  needing per-category icons. Cycles through 6 accent pairs. */
const ACCENTS = [
  'bg-orange-50 text-orange-700',
  'bg-sky-50 text-sky-700',
  'bg-emerald-50 text-emerald-700',
  'bg-violet-50 text-violet-700',
  'bg-rose-50 text-rose-700',
  'bg-amber-50 text-amber-700'
];

function Section({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b-[6px] border-slate-100 bg-white">
      <p className="px-4 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        {title}
      </p>
      {children}
    </section>
  );
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.85}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 1 0-5.66-5.66l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 1 0 5.66 5.66l1-1" />
    </svg>
  );
}

function MenuIcon({ className }: { className?: string }) {
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
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
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
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
    </svg>
  );
}

/** Direction-aware chevron (uses logical end side for RTL/LTR). */
function ChevronEndIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${className ?? ''} rtl:-scale-x-100`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
