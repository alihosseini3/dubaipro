import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { AccountSidebar } from '@/components/account/AccountSidebar';
import { WishlistList } from '@/components/wishlist/WishlistList';
import { requireUser } from '@/lib/auth/require-user';
import { getDisplayContext } from '@/lib/currency/context';
import {
  asCurrency,
  formatDisplay,
  formatDisplayFromAED
} from '@/lib/currency/service';
import { listWishlistItems } from '@/lib/wishlist/service';
import { BASE_CURRENCY } from '@/types/currency';

type Props = { params: Promise<{ locale: string }> };

export default async function WishlistPage({ params }: Props) {
  const { locale } = await params;
  const user = await requireUser(locale, '/account/wishlist');
  const t = await getTranslations({ locale, namespace: 'wishlist' });
  const items = await listWishlistItems(user.id);

  // Pre-format the price for each wishlist row on the server. The
  // currency formatter is server-only, but `WishlistList` is a client
  // component (needs router + state) — passing a pre-built map keeps
  // the boundary clean and avoids leaking the formatter into the
  // bundle.
  const { display, rates } = await getDisplayContext(locale);
  const formattedPrices = Object.fromEntries(
    items.map((item) => {
      const amount = Number(item.product.price);
      const from = asCurrency(item.product.currency);
      const formatted =
        from && from !== BASE_CURRENCY
          ? formatDisplay(amount, from, display, rates)
          : formatDisplayFromAED(amount, display);
      return [item.id, formatted];
    })
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <AccountSidebar locale={locale} user={user} />
      <div className="lg:col-span-2 space-y-4">
        <header>
          <h1 className="text-2xl font-semibold text-slate-900">
            {t('page.title')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {t('page.subtitle', { count: items.length })}
          </p>
        </header>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mx-auto h-16 w-16 text-slate-300"
              aria-hidden
            >
              <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
            </svg>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">
              {t('page.emptyTitle')}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {t('page.emptyDescription')}
            </p>
            <Link
              href={`/${locale}/products`}
              className="mt-4 inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              {t('page.browseProducts')}
            </Link>
          </div>
        ) : (
          <WishlistList
            items={items}
            locale={locale}
            formattedPrices={formattedPrices}
          />
        )}
      </div>
    </div>
  );
}
