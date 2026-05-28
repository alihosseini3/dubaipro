import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { getCurrentUser } from '@/lib/auth/session';
import { getItemCount } from '@/lib/cart/service';
import { getWishlistCount } from '@/lib/wishlist/service';
import { LocaleSwitcher } from './locale-switcher';
import { WishlistBadge } from './wishlist/WishlistBadge';
import { UserMenu } from './auth/UserMenu';

type NavbarProps = {
  locale: string;
};

export async function Navbar({ locale }: NavbarProps) {
  const [tNav, tAuth, user] = await Promise.all([
    getTranslations({ locale, namespace: 'navbar' }),
    getTranslations({ locale, namespace: 'auth' }),
    getCurrentUser()
  ]);

  const base = `/${locale}`;

  return (
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm">
      <nav className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between px-4">
        <Link href={base} className="text-sm font-semibold tracking-wide text-slate-900">
          dubaipro
        </Link>
        <div className="flex items-center gap-6">
          <Link
            href={base}
            className="text-sm text-slate-600 transition-colors hover:text-slate-900"
          >
            {tNav('home')}
          </Link>
          <Link
            href={`${base}/products`}
            className="text-sm text-slate-600 transition-colors hover:text-slate-900"
          >
            {tNav('products')}
          </Link>
          <Link
            href={`${base}/contact`}
            className="text-sm text-slate-600 transition-colors hover:text-slate-900"
          >
            {tNav('contact')}
          </Link>

          {user && (
            <>
              <CartBadge locale={locale} userId={user.id} />
              <WishlistBadge locale={locale} userId={user.id} />
            </>
          )}

          <LocaleSwitcher />

          {user ? (
            <div className="flex items-center gap-3 border-l border-slate-200 ps-4">
              <UserMenu
                locale={locale}
                user={{ name: user.name, email: user.email, role: user.role }}
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
              <Link
                href={`${base}/login`}
                className="text-sm font-semibold text-slate-700 transition-colors hover:text-slate-900"
              >
                {tAuth('signIn')}
              </Link>
              <Link
                href={`${base}/register`}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                {tAuth('signUp')}
              </Link>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}

async function CartBadge({ locale, userId }: { locale: string; userId: string }) {
  const count = await getItemCount(userId).catch(() => 0);
  return (
    <Link
      href={`/${locale}/cart`}
      className="relative inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
      aria-label="Cart"
    >
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
      {count > 0 && (
        <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white shadow-sm">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
