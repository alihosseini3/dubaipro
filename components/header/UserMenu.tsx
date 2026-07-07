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
import type { UserRole } from '@prisma/client';

type Props = {
  locale: string;
  user: { name: string; email: string; role: UserRole } | null;
  labels: {
    accountTrigger: string;
    greetingGuest: string;
    greetingUser: string;
    signIn: string;
    register: string;
    dashboard: string;
    orders: string;
    messages: string;
    addresses: string;
    profile: string;
    adminPanel: string;
    logout: string;
    loggingOut: string;
  };
};

type Item = { key: string; href: string; label: string; icon: ReactElement };

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

/**
 * Header user menu — dark trigger on the navy main header.
 *
 *  - Guest: trigger shows "Sign in / Register"; dropdown surfaces both
 *    auth CTAs plus a tiny welcome line.
 *  - Logged in: trigger shows the user's first name + avatar initial;
 *    dropdown lists Dashboard / Orders / Messages / Addresses / Profile,
 *    Admin (when applicable), and Logout.
 *
 * All copy is passed in via `labels` so this stays a leaf client
 * component and i18n stays a server concern.
 */
export function UserMenu({ locale, user, labels }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const close = useCallback(() => setOpen(false), []);

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
  const initial = user?.name.trim().charAt(0).toUpperCase() || 'U';
  const isSupplier = user?.role === 'SUPPLIER';

  const items: Item[] = user
    ? [
        {
          key: 'dashboard',
          href: isSupplier ? `${base}/supplier` : `${base}/account`,
          label: labels.dashboard,
          icon: mkIcon('M3 12l9-9 9 9M5 10v10h14V10')
        },
        {
          key: 'orders',
          href: `${base}/account/orders`,
          label: labels.orders,
          icon: mkIcon('M6 2l2 4h8l2-4M4 6h16v14H4zM9 10v6m6-6v6')
        },
        {
          key: 'messages',
          href: `${base}/account/messages`,
          label: labels.messages,
          icon: mkIcon('M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z')
        },
        {
          key: 'addresses',
          href: `${base}/account/addresses`,
          label: labels.addresses,
          icon: mkIcon(
            'M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12zm0-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'
          )
        },
        {
          key: 'profile',
          href: isSupplier ? `${base}/supplier/profile` : `${base}/account/profile`,
          label: labels.profile,
          icon: mkIcon('M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21a8 8 0 0 1 16 0')
        }
      ]
    : [];

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        className="flex h-10 items-center gap-2 rounded-lg px-2.5 text-white transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
      >
        {user ? (
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-xs font-bold text-white">
            {initial}
          </span>
        ) : (
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21a8 8 0 0 1 16 0" />
          </svg>
        )}
        <span className="hidden flex-col items-start leading-tight md:flex">
          <span className="text-[10px] text-slate-400">
            {user ? labels.greetingUser : labels.greetingGuest}
          </span>
          <span className="text-xs font-semibold">
            {user ? labels.accountTrigger : `${labels.signIn} / ${labels.register}`}
          </span>
        </span>
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute end-0 mt-2 w-64 origin-top-end overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-black/5"
          style={{ animation: 'fadeIn 140ms ease-out' }}
        >
          {user ? (
            <>
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
                      {labels.adminPanel}
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
                  {pending ? labels.loggingOut : labels.logout}
                </button>
              </div>
            </>
          ) : (
            <div className="p-4">
              <Link
                href={`${base}/login`}
                onClick={close}
                className="block w-full rounded-lg bg-orange-500 px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-orange-600"
              >
                {labels.signIn}
              </Link>
              <p className="mt-3 text-center text-xs text-slate-600">
                {labels.greetingGuest}{' '}
                <Link
                  href={`${base}/register`}
                  onClick={close}
                  className="font-semibold text-orange-600 hover:underline"
                >
                  {labels.register}
                </Link>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
