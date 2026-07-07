'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type SupplierNavItem = {
  key: string;
  label: string;
  href: string;
  /** Match `pathname` exactly instead of by prefix (used for Overview). */
  exact?: boolean;
};

type Props = {
  locale: string;
  supplierName: string;
  statusLabel: string;
  statusTone: 'verified' | 'pending' | 'rejected';
  logoUrl: string | null;
  storefrontHref: string | null;
  nav: SupplierNavItem[];
  children: ReactNode;
};

const ICONS: Record<string, ReactNode> = {
  overview: (
    <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  ),
  products: <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />,
  analytics: <path d="M9 19v-6a1 1 0 00-1-1H5a1 1 0 00-1 1v6m5 0H4m5 0h6m0 0V9a1 1 0 011-1h3a1 1 0 011 1v10m-5 0h5m0 0V5a1 1 0 011-1h0" />,
  profile: <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,
};

const STATUS_TONES: Record<Props['statusTone'], string> = {
  verified: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  rejected: 'bg-red-50 text-red-700 ring-red-200',
};

function NavIcon({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      {ICONS[name] ?? ICONS.overview}
    </svg>
  );
}

export function SupplierShell({
  locale,
  supplierName,
  statusLabel,
  statusTone,
  logoUrl,
  storefrontHref,
  nav,
  children,
}: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (item: SupplierNavItem) => {
    const path = pathname ?? '';
    if (item.exact) return path === item.href;
    return path === item.href || path.startsWith(`${item.href}/`);
  };

  const initial = supplierName.trim().charAt(0).toUpperCase() || 'S';

  const sidebar = (
    <div className="flex h-full flex-col">
      {/* Brand / identity */}
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-lg font-bold text-white shadow-sm">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            initial
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900">{supplierName}</p>
          <span
            className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${STATUS_TONES[statusTone]}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Menu
        </p>
        {nav.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.key}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                active
                  ? 'bg-orange-50 text-orange-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className={active ? 'text-orange-600' : 'text-slate-400'}>
                <NavIcon name={item.key} />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer actions */}
      <div className="space-y-1 border-t border-slate-100 px-3 py-4">
        {storefrontHref && (
          <Link
            href={storefrontHref}
            target="_blank"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-slate-400" aria-hidden>
              <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            View storefront
          </Link>
        )}
        <Link
          href={`/${locale}`}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-slate-400" aria-hidden>
            <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2M5 10l7-7 7 7" />
          </svg>
          Back to site
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 border-e border-slate-200 bg-white lg:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-slate-900/50"
          />
          <aside className="absolute inset-y-0 start-0 w-72 max-w-[80%] bg-white shadow-xl">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:ps-64">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 lg:hidden"
              aria-label="Open menu"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5" aria-hidden>
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="lg:hidden">
              <p className="text-sm font-bold text-slate-900">{supplierName}</p>
            </div>
            <p className="hidden text-sm font-semibold text-slate-400 lg:block">
              Supplier dashboard
            </p>
          </div>

          <div className="flex items-center gap-2">
            {nav.some((n) => n.key === 'products') && (
              <Link
                href={`/${locale}/supplier/products/new`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700"
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4" aria-hidden>
                  <path d="M10 4v12M4 10h12" />
                </svg>
                <span className="hidden sm:inline">Add product</span>
              </Link>
            )}
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
