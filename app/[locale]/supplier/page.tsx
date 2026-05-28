import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { AdminCard } from '@/components/admin/AdminCard';
import { PriceView } from '@/components/currency/PriceView';
import { StatCard } from '@/components/analytics/StatCard';
import { requireSupplier } from '@/lib/auth/require-supplier';
import { parseRange } from '@/lib/analytics/service';
import { getSupplierAnalytics } from '@/lib/analytics/supplier-service';
import { getDisplayCurrency } from '@/lib/currency/context';

type Props = {
  params: Promise<{ locale: string }>;
};

/**
 * Supplier overview — quick 7-day snapshot. The detailed view with
 * date-range filtering lives at `/[locale]/supplier/analytics`.
 */
export default async function SupplierOverviewPage({ params }: Props) {
  const { locale } = await params;
  const { supplier } = await requireSupplier(locale, `/${locale}/supplier`);

  const range = parseRange({ preset: '7d', from: null, to: null });

  const [t, display, data] = await Promise.all([
    getTranslations({ locale, namespace: 'supplier.overview' }),
    getDisplayCurrency(locale),
    getSupplierAnalytics(supplier.id, range)
  ]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">{t('last7Days')}</p>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label={t('clicks')}
          value={data.totals.clicks.toLocaleString()}
          hint={t('clicksHint')}
          accent="emerald"
        />
        <StatCard
          label={t('conversions')}
          value={data.totals.attributedOrders.toLocaleString()}
          hint={`${(data.totals.conversionRate * 100).toFixed(1)}% ${t(
            'conversionRate'
          )}`}
          accent="sky"
        />
        <StatCard
          label={t('revenue')}
          value={
            <PriceView
              amount={data.totals.attributedRevenue}
              display={display}
            />
          }
          hint={t('inBase')}
          accent="violet"
        />
      </section>

      <AdminCard>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              {t('viewFull')}
            </h2>
            <p className="text-xs text-slate-500">{t('viewFullHint')}</p>
          </div>
          <Link
            href={`/${locale}/supplier/analytics`}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            {t('openAnalytics')}
          </Link>
        </div>
      </AdminCard>
    </div>
  );
}
