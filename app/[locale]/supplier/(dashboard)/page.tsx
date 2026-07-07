import Link from 'next/link';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { requireSupplier } from '@/lib/auth/require-supplier';
import { prisma } from '@/lib/prisma';
import { parseRange } from '@/lib/analytics/service';
import { getSupplierAnalytics } from '@/lib/analytics/supplier-service';
import { getDisplayCurrency } from '@/lib/currency/context';
import { PriceView } from '@/components/currency/PriceView';
import { StatCard } from '@/components/analytics/StatCard';
import { AdminCard } from '@/components/admin/AdminCard';

export const metadata: Metadata = { title: 'Overview | Supplier Dashboard' };

type Props = { params: Promise<{ locale: string }> };

const ICONS = {
  box: <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />,
  click: <path d="M9 3v2m6-2v2M9 19v2m6-2v2M3 9h2m-2 6h2m14-6h2m-2 6h2M7 7h10v10H7z" />,
  cart: <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.3 4.6A1 1 0 005.6 19H17m0 0a2 2 0 100 4 2 2 0 000-4zm-9 2a2 2 0 11-4 0 2 2 0 014 0z" />,
  money: <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
};

function StatIcon({ d }: { d: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
      {d}
    </svg>
  );
}

export default async function SupplierOverviewPage({ params }: Props) {
  const { locale } = await params;
  const { supplier, user } = await requireSupplier(locale, `/${locale}/supplier`);

  const range = parseRange({ preset: '7d', from: null, to: null });

  const [t, display, data, productStats, profile] =
    await Promise.all([
      getTranslations({ locale, namespace: 'supplier.overview' }),
      getDisplayCurrency(locale),
      getSupplierAnalytics(supplier.id, range),
      prisma.product.groupBy({
        by: ['isPublished'],
        where: { supplierId: supplier.id },
        _count: { id: true },
      }),
      prisma.supplier.findUnique({
        where: { id: supplier.id },
        select: {
          slug: true,
          status: true,
          logoUrl: true,
          description: true,
          bannerUrl: true,
          companyType: true,
          profileViews: true,
          followerCount: true,
        },
      }),
    ]);

  const publishedCount =
    productStats.find((s) => s.isPublished)?._count.id ?? 0;
  const draftCount = productStats.find((s) => !s.isPublished)?._count.id ?? 0;
  const totalProducts = publishedCount + draftCount;

  const storefrontHref = profile?.slug ? `/${locale}/suppliers/${profile.slug}` : null;

  // Lightweight profile-completeness checklist.
  const checklist = [
    { label: t('checklistLogo'), done: !!profile?.logoUrl, href: `/${locale}/supplier/profile` },
    { label: t('checklistDesc'), done: !!profile?.description, href: `/${locale}/supplier/profile` },
    { label: t('checklistProduct'), done: publishedCount > 0, href: `/${locale}/supplier/products/new` },
    { label: t('checklistVerify'), done: profile?.status === 'ACTIVE', href: `/${locale}/supplier/profile` },
  ];
  const completed = checklist.filter((c) => c.done).length;
  const completion = Math.round((completed / checklist.length) * 100);

  const firstName = user.name?.split(' ')[0] ?? supplier.name;

  const quickActions = [
    { label: t('addProduct'), desc: t('addProductDesc'), href: `/${locale}/supplier/products/new`, accent: 'bg-orange-50 text-orange-600' },
    { label: t('analyticsLink'), desc: t('analyticsDesc'), href: `/${locale}/supplier/analytics`, accent: 'bg-violet-50 text-violet-600' },
    { label: t('myProducts'), desc: t('myProductsInCatalog', { count: totalProducts }), href: `/${locale}/supplier/products`, accent: 'bg-emerald-50 text-emerald-600' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {t('welcomeBack', { name: firstName })}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {t('storeActivity', { range: t('last7Days') })}
          </p>
        </div>
        <Link
          href={`/${locale}/supplier/analytics`}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          {t('viewFull')}
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
            <path d="M7 5l5 5-5 5" />
          </svg>
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('publishedProducts')}
          value={publishedCount.toLocaleString()}
          hint={draftCount > 0 ? t('drafts', { count: draftCount }) : t('allLive')}
          accent="emerald"
          icon={<StatIcon d={ICONS.box} />}
        />
        <StatCard
          label={t('clicks')}
          value={data.totals.clicks.toLocaleString()}
          hint={t('clicksHint')}
          accent="sky"
          icon={<StatIcon d={ICONS.click} />}
        />
        <StatCard
          label={t('conversions')}
          value={data.totals.attributedOrders.toLocaleString()}
          hint={`${(data.totals.conversionRate * 100).toFixed(1)}% ${t('conversionRate')}`}
          accent="amber"
          icon={<StatIcon d={ICONS.cart} />}
        />
        <StatCard
          label={t('revenue')}
          value={<PriceView amount={data.totals.attributedRevenue} display={display} />}
          hint={t('inBase')}
          accent="violet"
          icon={<StatIcon d={ICONS.money} />}
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {quickActions.map((a) => (
          <Link
            key={a.label}
            href={a.href}
            className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${a.accent}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </div>
            <p className="mt-3 text-sm font-bold text-slate-900">{a.label}</p>
            <p className="text-xs text-slate-500">{a.desc}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Top products */}
        <div className="lg:col-span-2">
          <AdminCard
            title={t('topProducts')}
            description={t('last7Days')}
            actions={
              <Link href={`/${locale}/supplier/products`} className="text-xs font-semibold text-orange-600 hover:text-orange-700">
                {t('viewAll')}
              </Link>
            }
          >
            {data.byProduct.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-slate-500">{t('noClicksYet')}</p>
                <Link href={`/${locale}/supplier/products/new`} className="mt-3 inline-block text-sm font-semibold text-orange-600 hover:text-orange-700">
                  {t('addToStart')}
                </Link>
              </div>
            ) : (
              (() => {
                const max = Math.max(1, ...data.byProduct.map((r) => r.clicks));
                return (
                  <ul className="space-y-3">
                    {data.byProduct.map((r) => (
                      <li key={r.productId} className="flex items-center gap-3 text-sm">
                        <span className="min-w-0 flex-1 truncate text-slate-700">
                          {r.slug ? (
                            <a href={`/${locale}/products/${r.slug}`} className="font-medium hover:text-slate-900 hover:underline">
                              {r.title ?? r.productId}
                            </a>
                          ) : (
                            (r.title ?? r.productId)
                          )}
                        </span>
                        <span className="h-2 w-28 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                          <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${(r.clicks / max) * 100}%` }} />
                        </span>
                        <span className="w-16 text-right text-xs tabular-nums font-semibold text-slate-600">
                          {r.clicks}
                        </span>
                      </li>
                    ))}
                  </ul>
                );
              })()
            )}
          </AdminCard>
        </div>

        {/* Profile completeness + activity */}
        <div className="space-y-6">
          <AdminCard title={t('profileSetup')}>
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-600">{t('percentComplete', { pct: completion })}</span>
              <span className="text-xs text-slate-400">{completed}/{checklist.length}</span>
            </div>
            <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${completion}%` }} />
            </div>
            <ul className="space-y-2">
              {checklist.map((c) => (
                <li key={c.label}>
                  <Link href={c.href} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition hover:bg-slate-50">
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${c.done ? 'bg-emerald-500 text-white' : 'border border-slate-300 text-transparent'}`}>
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" aria-hidden>
                        <path d="M4 10l4 4 8-8" />
                      </svg>
                    </span>
                    <span className={c.done ? 'text-slate-400 line-through' : 'text-slate-700'}>{c.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </AdminCard>

          <AdminCard title={t('atAGlance')}>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{t('profileViews')}</dt>
                <dd className="mt-1 text-xl font-bold text-slate-900">{(profile?.profileViews ?? 0).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{t('followers')}</dt>
                <dd className="mt-1 text-xl font-bold text-slate-900">{(profile?.followerCount ?? 0).toLocaleString()}</dd>
              </div>
            </dl>
            {storefrontHref && (
              <Link href={storefrontHref} target="_blank" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-orange-600 hover:text-orange-700">
                {t('viewStorefront')}
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
                  <path d="M7 5l5 5-5 5" />
                </svg>
              </Link>
            )}
          </AdminCard>
        </div>
      </div>
    </div>
  );
}
