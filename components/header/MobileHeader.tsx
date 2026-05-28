import { getTranslations } from 'next-intl/server';

import { getCurrentUser } from '@/lib/auth/session';
import { getItemCount } from '@/lib/cart/service';
import { listCategories } from '@/lib/categories/service';
import { getDisplayCurrency } from '@/lib/currency/context';
import { getHeaderSettings, listNavigationItems } from '@/lib/header/service';

import { MobileHeaderClient } from './MobileHeaderClient';

type Props = { locale: string };

/**
 * Server entry-point for the mobile header.
 *
 * Resolves everything the mobile shell needs up front so the only JS
 * on the client is the drawer and search interactions themselves.
 */
export async function MobileHeader({ locale }: Props) {
  const [tMain, tDrawer, user, categories, settings, navItems, display] =
    await Promise.all([
      getTranslations({ locale, namespace: 'header.main' }),
      getTranslations({ locale, namespace: 'header.drawer' }),
      getCurrentUser(),
      listCategories().catch(() => []),
      getHeaderSettings(),
      listNavigationItems({ activeOnly: true }),
      getDisplayCurrency(locale)
    ]);
  const cartCount = user ? await getItemCount(user.id).catch(() => 0) : 0;

  const base = `/${locale}`;
  const navLinks = navItems.map((n) => ({
    href: n.href.startsWith('http')
      ? n.href
      : `${base}${n.href.startsWith('/') ? n.href : `/${n.href}`}`,
    label: n.label
  }));

  return (
    <MobileHeaderClient
      locale={locale}
      logoUrl={settings.logoUrl}
      logoText={settings.logoText}
      showSearch={settings.showSearch}
      navLinks={navLinks}
      categories={categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug
      }))}
      currency={display.code}
      user={user ? { name: user.name, email: user.email } : null}
      cartCount={cartCount}
      cartLabel={tMain('cart')}
      searchLabels={{
        placeholder: tMain('searchPlaceholder'),
        allCategories: tMain('allCategories'),
        button: tMain('searchButton'),
        open: tMain('searchOpen'),
        close: tMain('searchClose')
      }}
      drawerLabels={{
        open: tDrawer('open'),
        close: tDrawer('close'),
        navigation: tDrawer('navigation'),
        categories: tDrawer('categories'),
        language: tDrawer('language'),
        currency: tDrawer('currency'),
        signIn: tDrawer('signIn'),
        register: tDrawer('register'),
        logout: tDrawer('logout'),
        account: tDrawer('account')
      }}
    />
  );
}
