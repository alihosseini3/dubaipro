import Link from 'next/link';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';

import { LocaleSwitcher } from '@/components/locale-switcher';

type AuthShellProps = {
  locale: string;
  title: string;
  subtitle: string;
  footerText: string;
  footerLinkLabel: string;
  footerLinkHref: string;
  children: ReactNode;
  /** Optional override for the brand panel headline (defaults to `brandTagline`). */
  brandTagline?: string;
  /** Optional override for the brand panel description (defaults to `brandDescription`). */
  brandDescription?: string;
};

/**
 * Premium split-screen auth layout.
 *
 * - Left: branded marketing panel (DubaiPro gradient + feature bullets).
 *   Hidden on mobile to keep the form as the hero on small screens.
 * - Right: form card on a soft neutral background.
 *
 * The layout is a CSS `grid` rather than absolute-positioned columns, so
 * RTL locales (fa/ar/ur) naturally flip the brand/form sides without
 * any extra work.
 */
export async function AuthShell({
  locale,
  title,
  subtitle,
  footerText,
  footerLinkLabel,
  footerLinkHref,
  children,
  brandTagline,
  brandDescription
}: AuthShellProps) {
  const t = await getTranslations({ locale, namespace: 'auth' });
  const headline = brandTagline ?? t('brandTagline');
  const description = brandDescription ?? t('brandDescription');

  return (
    <div className="relative min-h-screen bg-slate-50 lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* ======================== LEFT — brand panel ======================== */}
      <aside
        className="relative hidden overflow-hidden bg-slate-900 lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16"
        aria-hidden
      >
        {/* Animated gradient wash */}
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(249,115,22,0.35),transparent_55%),radial-gradient(circle_at_80%_80%,rgba(56,189,248,0.25),transparent_50%),linear-gradient(135deg,#0f172a_0%,#1e293b_60%,#0f172a_100%)]"
        />

        {/* Subtle dot grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              'radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)',
            backgroundSize: '22px 22px'
          }}
        />

        {/* Abstract floating orbs */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-orange-500/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-96 w-96 rounded-full bg-sky-500/20 blur-3xl" />

        {/* Logo */}
        <div className="relative z-10">
          <Link
            href={`/${locale}`}
            className="inline-flex items-center gap-3 text-white transition hover:opacity-90"
            aria-hidden={false}
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-lg font-black tracking-tight shadow-lg shadow-orange-900/30">
              D
            </span>
            <span className="flex flex-col leading-none">
              <span className="text-xl font-bold tracking-tight">
                {t('brandName')}
              </span>
              <span className="mt-1 text-[11px] font-medium uppercase tracking-[0.15em] text-slate-400">
                {t('brandSubtitle')}
              </span>
            </span>
          </Link>
        </div>

        {/* Tagline */}
        <div className="relative z-10 max-w-lg">
          <h2 className="text-4xl font-bold leading-tight tracking-tight text-white xl:text-5xl">
            {headline}
          </h2>
          <p className="mt-5 text-base leading-relaxed text-slate-300">
            {description}
          </p>

          {/* Feature bullets */}
          <ul className="mt-8 space-y-3">
            {[t('brandFeature1'), t('brandFeature2'), t('brandFeature3')].map(
              (feature) => (
                <li
                  key={feature}
                  className="flex items-center gap-3 text-sm text-slate-200"
                >
                  <span className="inline-flex h-6 w-6 flex-none items-center justify-center rounded-full bg-orange-500/20 ring-1 ring-inset ring-orange-400/40">
                    <svg
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-3.5 w-3.5 text-orange-300"
                    >
                      <path d="M4 10l4 4 8-8" />
                    </svg>
                  </span>
                  <span>{feature}</span>
                </li>
              )
            )}
          </ul>
        </div>

        {/* Footer note */}
        <div className="relative z-10 text-xs text-slate-400">
          © {new Date().getFullYear()} {t('brandName')}
        </div>
      </aside>

      {/* ======================== RIGHT — form panel ======================== */}
      <main className="relative flex min-h-screen flex-col px-4 py-8 sm:px-6 lg:min-h-0 lg:px-10 lg:py-12">
        {/* Top bar: mobile logo + locale switcher */}
        <div className="flex items-center justify-between">
          <Link
            href={`/${locale}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 transition hover:opacity-80 lg:hidden"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-base font-black text-white shadow-md shadow-orange-900/20">
              D
            </span>
            <span className="flex flex-col leading-none">
              <span className="text-base font-bold tracking-tight">
                {t('brandName')}
              </span>
              <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.15em] text-slate-500">
                {t('brandSubtitle')}
              </span>
            </span>
          </Link>
          <span className="hidden lg:block" />
          <LocaleSwitcher />
        </div>

        {/* Centered form card */}
        <div className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-md animate-[fadeInUp_0.5s_ease-out]">
            <div className="rounded-2xl border border-slate-200/70 bg-white p-8 shadow-[0_10px_40px_-15px_rgba(15,23,42,0.15)] sm:p-10">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                {title}
              </h1>
              <p className="mt-2 text-sm text-slate-500">{subtitle}</p>

              <div className="mt-7">{children}</div>
            </div>

            <p className="mt-6 text-center text-sm text-slate-600">
              {footerText}{' '}
              <Link
                href={footerLinkHref}
                className="font-semibold text-slate-900 underline-offset-4 transition hover:text-orange-600 hover:underline"
              >
                {footerLinkLabel}
              </Link>
            </p>
          </div>
        </div>

        {/* Keyframes — scoped via style tag so we don't require a Tailwind config change */}
        <style>{`
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </main>
    </div>
  );
}
