import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { getCurrentUser } from '@/lib/auth/session';
import { getDisplayCurrency } from '@/lib/currency/context';

import { CurrencySwitcher } from './CurrencySwitcher';
import { HeaderLocaleSwitcher } from './HeaderLocaleSwitcher';

type Props = { locale: string };

/**
 * Layer 1 — utility / trust bar. ~36px tall, semi-transparent over
 * the dark gradient header so depth comes from the parent shadow.
 *
 * Left side  → trust badges (shipping · verified · secure).
 * Right side → language, currency, quick auth.
 */
export async function TopBar({ locale }: Props) {
  const [t, user, display] = await Promise.all([
    getTranslations({ locale, namespace: 'header.topbar' }),
    getCurrentUser(),
    getDisplayCurrency(locale)
  ]);

  const base = `/${locale}`;

  return (
    <div className="hidden border-b border-white/5 text-[12px] text-slate-300 md:block">
      <div className="mx-auto flex h-9 w-full max-w-[1600px] items-center justify-between gap-4 px-4 md:px-6 lg:px-8">
        {/* Trust badges */}
        <ul className="flex items-center gap-5">
          <li className="inline-flex items-center gap-1.5">
            <TruckIcon className="h-3.5 w-3.5 text-orange-400" />
            <span>{t('trustShipping')}</span>
          </li>
          <li className="hidden items-center gap-1.5 md:inline-flex">
            <ShieldCheckIcon className="h-3.5 w-3.5 text-emerald-400" />
            <span>{t('trustVerified')}</span>
          </li>
          <li className="hidden items-center gap-1.5 lg:inline-flex">
            <LockIcon className="h-3.5 w-3.5 text-sky-400" />
            <span>{t('trustSecure')}</span>
          </li>
        </ul>

        {/* Switchers + auth */}
        <div className="flex items-center gap-3">
          <HeaderLocaleSwitcher />
          <span aria-hidden className="hidden h-3 w-px bg-white/10 md:inline" />
          <CurrencySwitcher value={display.code} />
          <span aria-hidden className="hidden h-3 w-px bg-white/10 lg:inline" />
          {user ? (
            <span className="hidden whitespace-nowrap text-slate-400 lg:inline">
              {t('greetingUser', { name: user.name.split(' ')[0] })}
            </span>
          ) : (
            <span className="hidden items-center gap-2 lg:inline-flex">
              <Link
                href={`${base}/login`}
                className="transition hover:text-white hover:underline"
              >
                {t('signIn')}
              </Link>
              <span aria-hidden className="text-slate-600">
                ·
              </span>
              <Link
                href={`${base}/register`}
                className="transition hover:text-white hover:underline"
              >
                {t('register')}
              </Link>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function TruckIcon({ className }: { className?: string }) {
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
      <path d="M3 7h11v8H3zM14 10h4l3 3v2h-7zM7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
    </svg>
  );
}

function ShieldCheckIcon({ className }: { className?: string }) {
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
      <path d="M12 3 4 6v6c0 4.5 3.5 8 8 9 4.5-1 8-4.5 8-9V6z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
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
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 1 1 8 0v4" />
    </svg>
  );
}
