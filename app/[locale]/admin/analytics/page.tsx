import { getTranslations } from 'next-intl/server';

import { AdminCard } from '@/components/admin/AdminCard';
import { BarChart } from '@/components/analytics/BarChart';
import { DateRangeFilter } from '@/components/analytics/DateRangeFilter';
import { LineChart } from '@/components/analytics/LineChart';
import { StatCard } from '@/components/analytics/StatCard';
import { TopCouponsList } from '@/components/analytics/TopCouponsList';
import { TopProductsList } from '@/components/analytics/TopProductsList';
import { PriceView } from '@/components/currency/PriceView';
import { getAnalytics, parseRange } from '@/lib/analytics/service';
import type { RangePreset } from '@/lib/analytics/types';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getDisplayCurrency } from '@/lib/currency/context';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    preset?: string;
    from?: string;
    to?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
  }>;
};

/**
 * Admin analytics dashboard.
 *
 * - Server-aggregates all KPIs in AED (the canonical base currency).
 * - Converts to the admin's display currency only inside leaf components.
 * - URL-backed range filter means the view is bookmarkable and shareable.
 *
 * The layout is three-tier: stat cards (hero), charts (trends), lists
 * (leaderboards) — matching the spec and mirroring Stripe/Shopify dashboards.
 */
export default async function AdminAnalyticsPage({
  params,
  searchParams
}: Props) {
  const { locale } = await params;
  await requireAdmin(locale, `/${locale}/admin/analytics`);

  const sp = await searchParams;
  const range = parseRange({
    preset: sp.preset ?? null,
    from: sp.from ?? null,
    to: sp.to ?? null
  });

  const [t, tNav, display, data] = await Promise.all([
    getTranslations({ locale, namespace: 'admin.analytics' }),
    getTranslations({ locale, namespace: 'admin.nav' }),
    getDisplayCurrency(locale),
    getAnalytics(range, {
      utmSource: sp.utm_source,
      utmMedium: sp.utm_medium,
      utmCampaign: sp.utm_campaign
    })
  ]);

  const presetLabels: Record<RangePreset, string> = {
    today: t('rangeToday'),
    '7d': t('range7d'),
    '30d': t('range30d'),
    custom: t('rangeCustom')
  };

  return (
    <div className="space-y-6">
      {/* Header + filter */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {tNav('analytics')}
          </h1>
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

      {/* Stat cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('totalRevenue')}
          value={<PriceView amount={data.totals.revenue} display={display} />}
          hint={t('inBase')}
          accent="emerald"
          icon={<IconRevenue />}
        />
        <StatCard
          label={t('totalOrders')}
          value={data.totals.orders.toLocaleString()}
          hint={t('paidTier')}
          accent="sky"
          icon={<IconOrders />}
        />
        <StatCard
          label={t('avgOrderValue')}
          value={
            <PriceView
              amount={data.totals.averageOrderValue}
              display={display}
            />
          }
          hint={t('perOrder')}
          accent="violet"
          icon={<IconAvg />}
        />
        <StatCard
          label={t('totalCustomers')}
          value={data.totals.customers.toLocaleString()}
          hint={t('couponsUsedLabel', {
            count: data.totals.couponsUsed
          })}
          accent="amber"
          icon={<IconCustomers />}
        />
      </section>

      {/* Charts */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AdminCard>
          <ChartHeading
            title={t('revenueOverTime')}
            subtitle={t('inBase')}
          />
          <LineChart
            data={data.revenueByDay}
            monetary
            display={display}
            ariaLabel={t('revenueOverTime')}
          />
        </AdminCard>
        <AdminCard>
          <ChartHeading
            title={t('ordersOverTime')}
            subtitle={t('dailyCount')}
          />
          <BarChart
            data={data.ordersByDay}
            ariaLabel={t('ordersOverTime')}
          />
        </AdminCard>
      </section>

      {/* Tables */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AdminCard>
          <ChartHeading
            title={t('topProducts')}
            subtitle={t('byRevenue')}
          />
          <TopProductsList
            items={data.topProducts}
            locale={locale}
            display={display}
            emptyLabel={t('emptyProducts')}
            unitsLabel={(count) => t('unitsSold', { count })}
          />
        </AdminCard>
        <AdminCard>
          <ChartHeading title={t('topCoupons')} subtitle={t('byUses')} />
          <TopCouponsList
            items={data.topCoupons}
            display={display}
            emptyLabel={t('emptyCoupons')}
            usesLabel={(count) => t('timesUsed', { count })}
          />
        </AdminCard>
      </section>

      {/* WhatsApp engagement */}
      <AdminCard>
        <UtmFilterForm
          preset={sp.preset}
          from={sp.from}
          to={sp.to}
          utmSource={data.whatsapp.filter.utmSource ?? ''}
          utmMedium={data.whatsapp.filter.utmMedium ?? ''}
          utmCampaign={data.whatsapp.filter.utmCampaign ?? ''}
          labels={{
            title: t('utmFilterTitle'),
            utmSource: t('utmSource'),
            utmMedium: t('utmMedium'),
            utmCampaign: t('utmCampaign'),
            apply: t('apply'),
            clear: t('utmClear')
          }}
          clearHref={`/${locale}/admin/analytics`}
        />
      </AdminCard>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('whatsappTotal')}
          value={data.whatsapp.total.toLocaleString()}
          hint={t('whatsappTotalHint')}
          accent="emerald"
          icon={<IconWhatsApp />}
        />
        <StatCard
          label={t('whatsappConversions')}
          value={data.whatsapp.attributedOrders.toLocaleString()}
          hint={`${(data.whatsapp.conversionRate * 100).toFixed(1)}% ${t(
            'whatsappConversionRate'
          )}`}
          accent="sky"
          icon={<IconWhatsApp />}
        />
        <StatCard
          label={t('whatsappRevenue')}
          value={
            <PriceView
              amount={data.whatsapp.attributedRevenue}
              display={display}
            />
          }
          hint={t('inBase')}
          accent="violet"
          icon={<IconWhatsApp />}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AdminCard>
          <ChartHeading
            title={t('whatsappByProduct')}
            subtitle={t('byClicks')}
          />
          <WhatsAppClicksList
            rows={data.whatsapp.byProduct.map((r) => ({
              key: r.productId,
              label: r.title ?? r.productId,
              href: r.slug ? `/${locale}/products/${r.slug}` : undefined,
              clicks: r.clicks
            }))}
            emptyLabel={t('emptyWhatsapp')}
            clicksLabel={(n) => t('clicksCount', { count: n })}
          />
        </AdminCard>
        <AdminCard>
          <ChartHeading
            title={t('whatsappBySupplier')}
            subtitle={t('byClicks')}
          />
          <WhatsAppClicksList
            rows={data.whatsapp.bySupplier.map((r) => ({
              key: r.supplierId,
              label: r.name ?? r.supplierId,
              href: `/${locale}/admin/suppliers/${r.supplierId}`,
              clicks: r.clicks
            }))}
            emptyLabel={t('emptyWhatsapp')}
            clicksLabel={(n) => t('clicksCount', { count: n })}
          />
        </AdminCard>
      </section>

      <AdminCard>
        <ChartHeading
          title={t('whatsappByCampaign')}
          subtitle={t('byClicks')}
        />
        <WhatsAppClicksList
          rows={data.whatsapp.byCampaign.map((r) => ({
            key: `${r.campaign}|${r.source}|${r.medium}`,
            label: [r.campaign, r.source, r.medium]
              .filter(Boolean)
              .join(' · '),
            clicks: r.clicks
          }))}
          emptyLabel={t('emptyCampaigns')}
          clicksLabel={(n) => t('clicksCount', { count: n })}
        />
      </AdminCard>
    </div>
  );
}

function UtmFilterForm({
  preset,
  from,
  to,
  utmSource,
  utmMedium,
  utmCampaign,
  labels,
  clearHref
}: {
  preset?: string;
  from?: string;
  to?: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  labels: {
    title: string;
    utmSource: string;
    utmMedium: string;
    utmCampaign: string;
    apply: string;
    clear: string;
  };
  clearHref: string;
}) {
  const inputClass =
    'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500';
  return (
    <form method="get" className="space-y-3">
      {/* Preserve date range from the URL so the WhatsApp filter composes
          with the existing range selector. */}
      {preset && <input type="hidden" name="preset" value={preset} />}
      {from && <input type="hidden" name="from" value={from} />}
      {to && <input type="hidden" name="to" value={to} />}

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">{labels.title}</h2>
        {(utmSource || utmMedium || utmCampaign) && (
          <a
            href={clearHref}
            className="text-xs font-medium text-slate-500 hover:text-slate-900"
          >
            {labels.clear}
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">
            {labels.utmSource}
          </span>
          <input
            name="utm_source"
            defaultValue={utmSource}
            placeholder="google"
            maxLength={64}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">
            {labels.utmMedium}
          </span>
          <input
            name="utm_medium"
            defaultValue={utmMedium}
            placeholder="cpc"
            maxLength={64}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">
            {labels.utmCampaign}
          </span>
          <input
            name="utm_campaign"
            defaultValue={utmCampaign}
            placeholder="launch"
            maxLength={64}
            className={inputClass}
          />
        </label>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          {labels.apply}
        </button>
      </div>
    </form>
  );
}

type ClickRow = {
  key: string;
  label: string;
  href?: string;
  clicks: number;
};

function WhatsAppClicksList({
  rows,
  emptyLabel,
  clicksLabel
}: {
  rows: ClickRow[];
  emptyLabel: string;
  clicksLabel: (count: number) => string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">{emptyLabel}</p>;
  }
  const max = Math.max(1, ...rows.map((r) => r.clicks));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.key} className="flex items-center gap-3 text-sm">
          <span className="min-w-0 flex-1 truncate text-slate-700">
            {r.href ? (
              <a
                href={r.href}
                className="hover:text-slate-900 hover:underline"
              >
                {r.label}
              </a>
            ) : (
              r.label
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
            {clicksLabel(r.clicks)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function IconWhatsApp() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <path d="M20 12a8 8 0 1 0-14.94 4L4 20l4.06-1.06A8 8 0 0 0 20 12z" />
      <path d="M9 10c0 .5.2 1 .5 1.5 1 1 2 1.5 3 1.5.5 0 1-.2 1.5-.5" />
    </svg>
  );
}

function ChartHeading({
  title,
  subtitle
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-4 flex items-baseline justify-between">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <span className="text-[11px] uppercase tracking-wide text-slate-400">
        {subtitle}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Minimal inline icons (24×24, stroke-based) — avoids a dependency.          */
/* -------------------------------------------------------------------------- */

function IconRevenue() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function IconOrders() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <path d="M6 2l2 4h8l2-4M4 6h16v14H4zM9 10v6m6-6v6" />
    </svg>
  );
}

function IconAvg() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <path d="M3 17l6-6 4 4 8-8M17 7h4v4" />
    </svg>
  );
}

function IconCustomers() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <path d="M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}
