'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement
} from 'react';
import { useTranslations } from 'next-intl';
import type { UserRole } from '@prisma/client';

type Props = {
  locale: string;
  user: { name: string; email: string; role: UserRole };
};

type Item = {
  key: string;
  href: string;
  label: string;
  icon: ReactElement;
};

const mkIcon = (d: string) => (
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

export function UserMenu({ locale, user }: Props) {
  const t = useTranslations('account.nav');
  const tAuth = useTranslations('auth');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const close = useCallback(() => setOpen(false), []);

  // Outside click
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        close();
        buttonRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  async function handleLogout() {
    setPending(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      close();
      router.push(`/${locale}`);
      router.refresh();
    }
  }

  const base = `/${locale}`;
  const isSupplier = user.role === 'SUPPLIER';
  const items: Item[] = [
    {
      key: 'dashboard',
      href: isSupplier ? `${base}/supplier` : `${base}/account`,
      label: t('dashboard'),
      icon: mkIcon('M3 12l9-9 9 9M5 10v10h14V10')
    },
    {
      key: 'orders',
      href: `${base}/account/orders`,
      label: t('orders'),
      icon: mkIcon('M6 2l2 4h8l2-4M4 6h16v14H4zM9 10v6m6-6v6')
    },
    {
      key: 'messages',
      href: `${base}/account/messages`,
      label: t('messages'),
      icon: mkIcon('M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z')
    },
    {
      key: 'addresses',
      href: `${base}/account/addresses`,
      label: t('addresses'),
      icon: mkIcon(
        'M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12zm0-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'
      )
    },
    {
      key: 'profile',
      href: isSupplier ? `${base}/supplier/profile` : `${base}/account/profile`,
      label: t('profile'),
      icon: mkIcon('M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21a8 8 0 0 1 16 0')
    }
  ];

  const initial = user.name.trim().charAt(0).toUpperCase() || 'U';

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 ps-1 pe-3 text-sm transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
      >
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-xs font-bold text-white">
          {initial}
        </span>
        <span className="hidden max-w-[120px] truncate font-medium text-slate-700 sm:inline">
          {user.name}
        </span>
        <svg
          viewBox="0 0 24 24"
          className={`hidden h-4 w-4 text-slate-500 transition-transform sm:inline ${
            open ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={t('profile')}
          className="absolute end-0 mt-2 w-64 origin-top-end overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg ring-1 ring-black/5"
          style={{ animation: 'fadeIn 120ms ease-out' }}
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="truncate text-sm font-semibold text-slate-900">
              {user.name}
            </p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>

          <ul className="py-1">
            {user.role === 'ADMIN' && (
              <li role="none">
                <Link
                  role="menuitem"
                  href={`${base}/admin`}
                  onClick={close}
                  className="flex items-center gap-3 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-orange-50 hover:text-orange-700"
                >
                  <span className="text-orange-600">
                    {mkIcon(
                      'M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 14.8 7.2 17l.9-5.4L4.2 7.7l5.4-.8L12 2z'
                    )}
                  </span>
                  {tAuth('adminPanel')}
                </Link>
              </li>
            )}
            {items.map((it) => (
              <li key={it.key} role="none">
                <Link
                  role="menuitem"
                  href={it.href}
                  onClick={close}
                  className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  <span className="text-slate-400">{it.icon}</span>
                  {it.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="border-t border-slate-100 py-1">
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              disabled={pending}
              className="flex w-full items-center gap-3 px-4 py-2 text-sm text-red-600 transition hover:bg-red-50 disabled:opacity-60"
            >
              <span>
                {mkIcon(
                  'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9'
                )}
              </span>
              {pending ? t('loggingOut') : t('logout')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
