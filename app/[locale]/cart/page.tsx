import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { CartView } from '@/components/cart/CartView';
import { RecentlyViewedShelf } from '@/components/conversion/RecentlyViewed';
import { getCurrentUser } from '@/lib/auth/session';
import { getCartDTO } from '@/lib/cart/service';
import { getDisplayCurrency } from '@/lib/currency/context';

type Props = { params: Promise<{ locale: string }> };

export default async function CartPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'cart' });

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/login?from=/${locale}/cart`);
  }

  const [cart, display] = await Promise.all([
    getCartDTO(user.id),
    getDisplayCurrency(locale)
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>
      </header>

      <CartView initialCart={cart} locale={locale} display={display} />

      <RecentlyViewedShelf locale={locale} title="You may also like" />
    </div>
  );
}
