'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';

type NavKey = 'dashboard' | 'orders' | 'wishlist' | 'messages' | 'addresses' | 'profile';

type NavItem = {
  key: NavKey;
  href: string; // without locale prefix
  icon: ReactElement;
};

const icon = (d: string) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-4 w-4"
    aria-hidden
  >
    <path d={d} />
  </svg>
);

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', href: '/account', icon: icon('M3 12l9-9 9 9M5 10v10h14V10') },
  { key: 'orders', href: '/account/orders', icon: icon('M6 2l2 4h8l2-4M4 6h16v14H4zM9 10v6m6-6v6') },
  { key: 'wishlist', href: '/account/wishlist', icon: icon('M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z') },
  { key: 'messages', href: '/account/messages', icon: icon('M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z') },
  { key: 'addresses', href: '/account/addresses', icon: icon('M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12zm0-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z') },
  { key: 'profile', href: '/account/profile', icon: icon('M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21a8 8 0 0 1 16 0') }
];

type Props = {
  locale: string;
  user: { name: string; email: string };
};

export function AccountSidebar({ locale, user }: Props) {
  const t = useTranslations('account.nav');
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push(`/${locale}/login`);
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <aside className="w-full lg:sticky lg:top-24 lg:w-64 lg:flex-none">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-sm font-bold text-white">
            {user.name.charAt(0).toUpperCase() || 'U'}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {user.name}
            </p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
        </div>

        <nav className="mt-5">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const href = `/${locale}${item.href}`;
              const active =
                item.href === '/account'
                  ? pathname === href
                  : pathname.startsWith(href);
              return (
                <li key={item.key}>
                  <Link
                    href={href}
                    className={
                      'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ' +
                      (active
                        ? 'bg-orange-50 text-orange-700'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900')
                    }
                  >
                    <span className="flex-none">{item.icon}</span>
                    <span>{t(item.key)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="mt-3 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-60"
          >
            <span className="flex-none">
              {icon('M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9')}
            </span>
            <span>{loggingOut ? t('loggingOut') : t('logout')}</span>
          </button>
        </nav>
      </div>
    </aside>
  );
}
