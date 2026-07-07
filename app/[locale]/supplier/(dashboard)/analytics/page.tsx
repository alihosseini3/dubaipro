import { getTranslations } from 'next-intl/server';

import { AdminCard } from '@/components/admin/AdminCard';
import { DateRangeFilter } from '@/components/analytics/DateRangeFilter';
import { StatCard } from '@/components/analytics/StatCard';
import { PriceView } from '@/components/currency/PriceView';
import { requireSupplier } from '@/lib/auth/require-supplier';
import { parseRange } from '@/lib/analytics/service';
import { getSupplierAnalytics } from '@/lib/analytics/supplier-service';
import type { RangePreset } from '@/lib/analytics/types';
import { getDisplayCurrency } from '@/lib/currency/context';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    preset?: string;
    from?: string;
    to?: string;
  }>;
};

/**
 * Supplier analytics — scoped to the authenticated supplier only.
 *
 * Security: `requireSupplier` redirects anyone without a linked
 * `Supplier` row. The aggregate service receives `supplier.id` (never a
 * client-supplied id), so another supplier's rows can never leak.
 */
export default async function SupplierAnalyticsPage({
  params,
  searchParams
}: Props) {
  const { locale } = await params;
  const { supplier } = await requireSupplier(
    locale,
    `/${locale}/supplier/analytics`
  );

  const sp = await searchParams;
  const range = parseRange({
    preset: sp.preset ?? null,
    from: sp.from ?? null,
    to: sp.to ?? null
  });

  const [t, display, data] = await Promise.all([
    getTranslations({ locale, namespace: 'supplier.analytics' }),
    getDisplayCurrency(locale),
    getSupplierAnalytics(supplier.id, range)
  ]);

  const presetLabels: Record<RangePreset, string> = {
    today: t('rangeToday'),
    '7d': t('range7d'),
    '30d': t('range30d'),
    custom: t('rangeCustom')
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{t('title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>
        </div>
        <DateRangeFilter
          current={data.range.preset}
          labels={presetLabels}
          customFromLabel={t('customFrom')}
          customToLabel={t('customTo')}
          applyLabel={t('apply')}
        />
      </header>

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
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            {t('byProduct')}
          </h2>
          <span className="text-xs text-slate-500">{t('byClicks')}</span>
        </div>
        {data.byProduct.length === 0 ? (
          <p className="text-sm text-slate-500">{t('empty')}</p>
        ) : (
          (() => {
            const max = Math.max(1, ...data.byProduct.map((r) => r.clicks));
            return (
              <ul className="space-y-2">
                {data.byProduct.map((r) => (
                  <li
                    key={r.productId}
                    className="flex items-center gap-3 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate text-slate-700">
                      {r.slug ? (
                        <a
                          href={`/${locale}/products/${r.slug}`}
                          className="hover:text-slate-900 hover:underline"
                        >
                          {r.title ?? r.productId}
                        </a>
                      ) : (
                        (r.title ?? r.productId)
                      )}
                    </span>
                    <span
                      className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100"
                      aria-hidden
                    >
                      <span
                        className="block h-full rounded-full bg-emerald-500"
                        style={{ width: `${(r.clicks / max) * 100}%` }}
                      />
                    </span>
                    <span className="w-20 text-right text-xs tabular-nums text-slate-500">
                      {t('clicksCount', { count: r.clicks })}
                    </span>
                  </li>
                ))}
              </ul>
            );
          })()
        )}
      </AdminCard>
    </div>
  );
}
