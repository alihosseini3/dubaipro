import { getTranslations } from 'next-intl/server';

import { getCurrentUser } from '@/lib/auth/session';
import { getItemCount } from '@/lib/cart/service';

import { MobileBottomNavClient } from './MobileBottomNavClient';

type Props = { locale: string };

/**
 * Server entry-point for the mobile bottom tab bar.
 *
 * Resolves the dynamic bits (cart count, user state, translated
 * labels) so the client part stays presentational and tiny.
 */
export async function MobileBottomNav({ locale }: Props) {
  const [t, user] = await Promise.all([
    getTranslations({ locale, namespace: 'header.bottomNav' }),
    getCurrentUser()
  ]);
  const cartCount = user ? await getItemCount(user.id).catch(() => 0) : 0;
  const base = `/${locale}`;

  const tabs = [
    {
      href: base,
      match: '^/$',
      label: t('home'),
      icon: <HomeIcon />
    },
    {
      href: `${base}/categories`,
      match: '^/categories(/|$)',
      label: t('categories'),
      icon: <GridIcon />
    },
    {
      href: `${base}/products`,
      match: '^/products(/|$)',
      label: t('search'),
      icon: <SearchIcon />
    },
    {
      href: `${base}/cart`,
      match: '^/cart(/|$)',
      label: t('cart'),
      icon: <CartIcon />,
      badge: cartCount
    },
    {
      href: user ? `${base}/account` : `${base}/login`,
      match: '^/(account|login|register)(/|$)',
      label: t('account'),
      icon: <UserIcon />
    }
  ];

  return <MobileBottomNavClient locale={locale} tabs={tabs} />;
}

/* -------------------- Icons -------------------- */

function HomeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 11 12 4l9 7" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
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

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.85}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
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

function UserIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
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
