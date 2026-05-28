'use client';

import Link from 'next/link';
import { useState } from 'react';

import type { Currency } from '@/types/currency';

import { MobileDrawer } from './MobileDrawer';
import { SearchBar } from './SearchBar';

type NavLink = { href: string; label: string };
type Category = { id: string; name: string; slug: string };

type Props = {
  locale: string;
  logoUrl: string | null;
  logoText: string;
  showSearch: boolean;
  navLinks: NavLink[];
  categories: Category[];
  currency: Currency;
  user: { name: string; email: string } | null;
  cartCount: number;
  cartLabel: string;
  searchLabels: {
    placeholder: string;
    allCategories: string;
    button: string;
    open: string;
    close: string;
  };
  drawerLabels: {
    open: string;
    close: string;
    navigation: string;
    categories: string;
    language: string;
    currency: string;
    signIn: string;
    register: string;
    logout: string;
    account: string;
  };
};

/**
 * Mobile-first header shell — uses the same dark palette as the
 * desktop layered header (`#0F172A` / `#111827` + orange accent) so
 * branding stays consistent across breakpoints.
 *
 * Layout:
 *   - Row 1 (#0F172A): hamburger · centered logo · search + cart
 *   - Row 2 (#111827): horizontally scrollable category chips
 *
 * The search icon expands the entire top row into a full-width
 * search bar (autofocus + close button). The drawer renders inside
 * `MobileDrawer`.
 */
export function MobileHeaderClient({
  locale,
  logoUrl,
  logoText,
  showSearch,
  navLinks,
  categories,
  currency,
  user,
  cartCount,
  cartLabel,
  searchLabels,
  drawerLabels
}: Props) {
  const [searchOpen, setSearchOpen] = useState(false);
  const base = `/${locale}`;

  return (
    <div className="md:hidden">
      {/* Row 1 — primary header */}
      <div className="bg-[#0F172A] text-white">
        <div className="mx-auto w-full max-w-[1600px] px-3">
          {searchOpen ? (
            <div
              className="flex min-h-[60px] items-center py-2"
              style={{ animation: 'fadeIn 180ms ease-out' }}
            >
              <SearchBar
                locale={locale}
                categories={categories}
                mobileOpen={searchOpen}
                onMobileOpenChange={setSearchOpen}
                hideMobileTrigger
                labels={searchLabels}
              />
            </div>
          ) : (
            <div
              className="grid min-h-[60px] grid-cols-[44px_1fr_auto] items-center gap-2"
              style={{ animation: 'fadeIn 180ms ease-out' }}
            >
              {/* Hamburger */}
              <div className="flex items-center justify-start">
                <MobileDrawer
                  locale={locale}
                  navLinks={navLinks}
                  categories={categories}
                  logoUrl={logoUrl}
                  logoText={logoText}
                  currency={currency}
                  tone="dark"
                  user={user}
                  labels={drawerLabels}
                />
              </div>

              {/* Centered logo */}
              <div className="flex min-w-0 justify-center">
                <Link
                  href={base}
                  aria-label={`${logoText} home`}
                  className="flex min-w-0 items-center justify-center rounded-lg px-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
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
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 text-sm font-black text-white shadow-[0_4px_12px_rgba(249,115,22,0.35)]">
                        {logoText.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="ms-2 truncate text-base font-bold tracking-tight text-white">
                        {logoText}
                      </span>
                    </>
                  )}
                </Link>
              </div>

              {/* Right actions */}
              <div className="flex items-center justify-end gap-1">
                {showSearch && (
                  <button
                    type="button"
                    aria-label={searchLabels.open}
                    onClick={() => setSearchOpen(true)}
                    className="inline-flex h-11 w-11 min-h-[44px] items-center justify-center rounded-xl text-white/90 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
                  >
                    <SearchIcon className="h-5 w-5" />
                  </button>
                )}
                <Link
                  href={`${base}/cart`}
                  aria-label={cartLabel}
                  className="relative inline-flex h-11 w-11 min-h-[44px] items-center justify-center rounded-xl text-white/90 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
                >
                  <CartIcon className="h-6 w-6" />
                  {cartCount > 0 && (
                    <span className="absolute -end-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white shadow-[0_0_0_2px_#0F172A] animate-pop">
                      {cartCount > 99 ? '99+' : cartCount}
                    </span>
                  )}
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 2 — horizontal category strip (hidden while searching) */}
      {!searchOpen && categories.length > 0 && (
        <div className="bg-[#111827] text-white">
          <div className="mx-auto w-full max-w-[1600px]">
            <nav
              aria-label={drawerLabels.categories}
              className="no-scrollbar flex gap-1 overflow-x-auto px-3 py-2"
            >
              <Link
                href={`${base}/categories`}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/15"
              >
                <GridIcon className="h-3.5 w-3.5" />
                {drawerLabels.categories}
              </Link>
              {categories.slice(0, 14).map((c) => (
                <Link
                  key={c.id}
                  href={`${base}/categories/${c.slug}`}
                  className="inline-flex shrink-0 items-center rounded-full px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
                >
                  {c.name}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}

function CartIcon({ className }: { className?: string }) {
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
      <path d="M3 3h2l.4 2M7 13h10l4-8H5.4" />
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function GridIcon({ className }: { className?: string }) {
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
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}
