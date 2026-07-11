import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { getCurrentUser } from '@/lib/auth/session';
import { listCategories } from '@/lib/categories/service';
import { getHeaderSettings } from '@/lib/header/service';

import { CartBadge } from './CartBadge';
import { SearchBar } from './SearchBar';
import { UserMenu } from './UserMenu';
import { WishlistBadge } from './WishlistBadge';
import { NotificationBell } from '@/components/notifications/NotificationBell';

type Props = { locale: string };

/**
 * Layer 2 — main header. The visual anchor of the site:
 *
 *   logo  |  large search bar (center, flex-1)  |  wishlist · cart · user
 *
 * SSR-resolves user, cart count, wishlist count, and the category
 * list (used as the search prefix dropdown), so there is zero
 * round-trip flicker on first paint.
 */
export async function MainHeader({ locale }: Props) {
  const [t, tAuth, user, categories, settings] = await Promise.all([
    getTranslations({ locale, namespace: 'header.main' }),
    getTranslations({ locale, namespace: 'header.userMenu' }),
    getCurrentUser(),
    listCategories().catch(() => []),
    getHeaderSettings()
  ]);

  const base = `/${locale}`;

  return (
    <div className="bg-[#0F172A] text-white">
      <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center gap-5 px-4 md:h-[88px] md:gap-8 md:px-6 lg:px-8">
        {/* Logo */}
        <Link
          href={base}
          aria-label={`${settings.logoText} home`}
          className="flex shrink-0 items-center gap-2.5 rounded-md transition focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
        >
          {settings.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={settings.logoUrl}
              alt={settings.logoText}
              className="h-10 w-auto max-w-[200px] object-contain"
            />
          ) : (
            <>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-base font-black text-white shadow-[0_4px_14px_rgba(249,115,22,0.35)]">
                {settings.logoText.slice(0, 2).toUpperCase()}
              </span>
              <span className="hidden text-lg font-bold tracking-tight md:inline">
                {settings.logoText}
              </span>
            </>
          )}
        </Link>

        {/* Search (center, flex-1) — admin can hide it entirely. */}
        {settings.showSearch && (
          <div className="ms-auto flex flex-1 justify-center md:ms-0">
            <SearchBar
              locale={locale}
              categories={categories.map((c) => ({
                id: c.id,
                name: c.name,
                slug: c.slug
              }))}
              labels={{
                placeholder: t('searchPlaceholder'),
                allCategories: t('allCategories'),
                button: t('searchButton'),
                open: t('searchOpen'),
                close: t('searchClose')
              }}
            />
          </div>
        )}
        {!settings.showSearch && <div className="flex-1" aria-hidden />}

        {/* Right cluster */}
        <div className="flex shrink-0 items-center gap-2">
          {user && <NotificationBell locale={locale} />}
          <WishlistBadge
            locale={locale}
            userId={user?.id ?? null}
            label={t('wishlist')}
          />
          <CartBadge
            locale={locale}
            userId={user?.id ?? null}
            label={t('cart')}
          />
          <UserMenu
            locale={locale}
            user={
              user
                ? { name: user.name, email: user.email, role: user.role }
                : null
            }
            labels={{
              accountTrigger: tAuth('accountTrigger'),
              greetingGuest: tAuth('greetingGuest'),
              // Resolve `{name}` server-side so the client component
              // receives a fully-formatted string (next-intl errors if
              // we read the raw ICU template without args).
              greetingUser: user
                ? tAuth('greetingUser', { name: user.name.split(' ')[0] })
                : tAuth('greetingGuest'),
              signIn: tAuth('signIn'),
              register: tAuth('register'),
              dashboard: tAuth('dashboard'),
              orders: tAuth('orders'),
              messages: tAuth('messages'),
              addresses: tAuth('addresses'),
              profile: tAuth('profile'),
              adminPanel: tAuth('adminPanel'),
              logout: tAuth('logout'),
              loggingOut: tAuth('loggingOut')
            }}
          />
        </div>
      </div>
    </div>
  );
}
