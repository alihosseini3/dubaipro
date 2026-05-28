import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { LocaleSwitcher } from '@/components/locale-switcher';
import { AdminMobileMenuButton } from './AdminMobileMenuButton';
import { AdminUserMenu } from './AdminUserMenu';
import type { SessionUser } from '@/lib/auth/session';

type AdminTopbarProps = {
  user: SessionUser;
  locale: string;
};

export async function AdminTopbar({ user, locale }: AdminTopbarProps) {
  const t = await getTranslations({ locale, namespace: 'admin.topbar' });

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-slate-200/80 bg-white/95 px-3 shadow-sm backdrop-blur-md sm:gap-3 sm:px-5">
      {/* Mobile hamburger */}
      <AdminMobileMenuButton />
      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <svg
          viewBox="0 0 24 24"
          className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-slate-400"
          fill="none" stroke="currentColor" strokeWidth={2} aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          placeholder={t('searchPlaceholder')}
          className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-[13px] text-slate-700 placeholder:text-slate-400 outline-none transition-all focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-400/20"
        />
        <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 sm:block">
          ⌘K
        </kbd>
      </div>

      <div className="flex flex-1 items-center justify-end gap-2">
        {/* View site */}
        <Link
          href={`/${locale}`}
          target="_blank"
          title={t('viewSite')}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </Link>

        {/* Notification bell */}
        <button
          type="button"
          title={t('notifications')}
          className="relative flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.158V11a6 6 0 0 0-9.9-4.55M6 11c0-1.526.573-2.914 1.51-3.959M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </button>

        <div className="h-5 w-px bg-slate-200" />

        <LocaleSwitcher />
        <AdminUserMenu user={user} locale={locale} />
      </div>
    </header>
  );
}
