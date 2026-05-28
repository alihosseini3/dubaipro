import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { CountdownTimer } from '@/components/auctions/CountdownTimer';
import { HammerIcon }     from '@/components/home/icons';
import { FilterSubmit }   from './FilterSubmit';
import { listAllAuctions, type AuctionDTO } from '@/lib/auctions/service';
import { localizeArray } from '@/lib/i18n/localize';
import { prisma }        from '@/lib/prisma';
import {
  buildAlternates,
  composeTitle,
  toOgAlternateLocales,
  toOgLocale,
  truncateDescription,
} from '@/lib/seo/site';

type SearchParams = {
  tab?:        string;
  category?:   string;
  supplier?:   string;
  endingSoon?: string;
  reserveMet?: string;
};

type PageParams = {
  params:       Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
};

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auctions' });
  const description = truncateDescription(t('metaDescription'));
  return {
    title:    composeTitle(t('metaTitle')),
    description,
    alternates: buildAlternates(locale, '/auctions'),
    openGraph: {
      type: 'website',
      title: t('metaTitle'),
      description,
      locale: toOgLocale(locale),
      alternateLocale: toOgAlternateLocales(locale),
    },
  };
}

const TABS = [
  { key: 'live',     statuses: ['LIVE'] },
  { key: 'upcoming', statuses: ['SCHEDULED'] },
  { key: 'ended',    statuses: ['ENDED'] },
] as const;

export default async function AuctionsListPage({ params, searchParams }: PageParams) {
  const { locale } = await params;
  const sp         = await searchParams;
  const t   = await getTranslations({ locale, namespace: 'auctions' });
  const tf  = await getTranslations({ locale, namespace: 'auctions.filters' });
  const te  = await getTranslations({ locale, namespace: 'auctions.empty' });
  const tcd = await getTranslations({ locale, namespace: 'auctions.card' });
  const ts  = await getTranslations({ locale, namespace: 'auctions.status' });
  const base = `/${locale}`;

  const [allAuctions, categoryRows, supplierRows] = await Promise.all([
    listAllAuctions(),
    prisma.category.findMany({
      where:  { auctions: { some: {} } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true },
    }).catch(() => []),
    prisma.supplier.findMany({
      where:  { auctions: { some: {} } },
      orderBy: [{ verified: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, verified: true },
    }).catch(() => []),
  ]);

  const tabKey   = (sp.tab ?? 'live') as typeof TABS[number]['key'];
  const activeTab = TABS.find((x) => x.key === tabKey) ?? TABS[0];

  /* Filter pipeline. */
  const now = Date.now();
  let filtered = allAuctions.filter((a) =>
    (activeTab.statuses as readonly string[]).includes(a.status)
  );
  if (sp.category)   filtered = filtered.filter((a) => a.categoryId === sp.category);
  if (sp.supplier)   filtered = filtered.filter((a) => a.supplierId === sp.supplier);
  if (sp.endingSoon === '1') {
    filtered = filtered.filter((a) => new Date(a.endsAt).getTime() - now < 60 * 60_000);
  }
  if (sp.reserveMet === '1') {
    filtered = filtered.filter((a) => a.reserveMet);
  }

  const auctions = await localizeArray(filtered, locale, ['title', 'supplierName']);
  const categories = await localizeArray(
    categoryRows.map((c) => ({ ...c, slug: c.slug })),
    locale,
    ['name']
  );

  const counts = {
    live:     allAuctions.filter((a) => a.status === 'LIVE').length,
    upcoming: allAuctions.filter((a) => a.status === 'SCHEDULED').length,
    ended:    allAuctions.filter((a) => a.status === 'ENDED').length,
  };

  /* Build href helper that preserves the active tab. */
  function hrefWith(patch: Partial<SearchParams>): string {
    const params = new URLSearchParams();
    const merged = { ...sp, ...patch };
    Object.entries(merged).forEach(([k, v]) => { if (v) params.set(k, String(v)); });
    const qs = params.toString();
    return `${base}/auctions${qs ? `?${qs}` : ''}`;
  }
  const hasActiveFilters = !!(sp.category || sp.supplier || sp.endingSoon || sp.reserveMet);

  return (
    <section className="space-y-8 py-2">
      {/* Hero header */}
      <header className="space-y-3">
        <p className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-orange-700">
          <HammerIcon className="h-3.5 w-3.5" />
          {counts.live > 0 ? t('liveNow', { count: counts.live }) : t('badge')}
        </p>
        <h1 className="text-3xl font-black tracking-tight text-[#0F172A] sm:text-4xl">
          {t('title')}
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-slate-600">{t('subtitle')}</p>
      </header>

      {/* Tabs */}
      <div className="flex w-fit gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab.key;
          const count = counts[tab.key];
          return (
            <Link
              key={tab.key}
              href={hrefWith({ tab: tab.key })}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                isActive
                  ? 'bg-[#0F172A] text-white shadow'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              {t(`tabs.${tab.key}`)}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
              }`}>{count}</span>
              {tab.key === 'live' && counts.live > 0 && (
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              )}
            </Link>
          );
        })}
      </div>

      {/* Two-column layout: filters sidebar + grid */}
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* Filters sidebar */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">
                {tf('title')}
              </h2>
              {hasActiveFilters && (
                <Link href={hrefWith({ category: undefined, supplier: undefined, endingSoon: undefined, reserveMet: undefined })}
                  className="text-[11px] font-semibold text-[#F97316] hover:underline">
                  {tf('clearAll')}
                </Link>
              )}
            </div>

            <FilterSubmit
              basePath={base}
              tab={activeTab.key}
              initialCategory={sp.category ?? ''}
              initialSupplier={sp.supplier ?? ''}
              endingSoon={sp.endingSoon === '1'}
              reserveMet={sp.reserveMet === '1'}
              categories={categories.map((c) => ({ id: c.id, name: c.name }))}
              suppliers={supplierRows.map((s) => ({ id: s.id, name: s.name, verified: s.verified }))}
              labels={{
                category:      tf('category'),
                allCategories: tf('allCategories'),
                supplier:      tf('supplier'),
                allSuppliers:  tf('allSuppliers'),
                submit:        tf('showResults', { count: filtered.length }),
              }}
            />

            {/* Toggle filters */}
            <ul className="mt-4 space-y-2">
              <li>
                <Link href={hrefWith({ endingSoon: sp.endingSoon === '1' ? undefined : '1' })}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                    sp.endingSoon === '1'
                      ? 'border-[#F97316] bg-orange-50 text-[#F97316]'
                      : 'border-slate-200 text-slate-600 hover:border-orange-200'
                  }`}>
                  <span className={`flex h-4 w-4 items-center justify-center rounded ${sp.endingSoon === '1' ? 'bg-[#F97316] text-white' : 'border border-slate-300'}`}>
                    {sp.endingSoon === '1' && <CheckIcon className="h-3 w-3" />}
                  </span>
                  {tf('endingSoon')}
                </Link>
              </li>
              <li>
                <Link href={hrefWith({ reserveMet: sp.reserveMet === '1' ? undefined : '1' })}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                    sp.reserveMet === '1'
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 text-slate-600 hover:border-emerald-200'
                  }`}>
                  <span className={`flex h-4 w-4 items-center justify-center rounded ${sp.reserveMet === '1' ? 'bg-emerald-500 text-white' : 'border border-slate-300'}`}>
                    {sp.reserveMet === '1' && <CheckIcon className="h-3 w-3" />}
                  </span>
                  {tf('reserveMet')}
                </Link>
              </li>
            </ul>

            <p className="mt-4 text-center text-[10px] font-semibold text-slate-500">
              {tf('showResults', { count: filtered.length })}
            </p>
          </div>
        </aside>

        {/* Grid */}
        <div>
          {auctions.length === 0 ? (
            <EmptyState locale={locale} tab={activeTab.key} hasFilters={hasActiveFilters} te={te} hrefClear={hrefWith({ tab: activeTab.key })} />
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {auctions.map((a) => (
                <li key={a.id}>
                  <AuctionCard auction={a} locale={locale} tcd={tcd} ts={ts} basePath={base} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Subcomponents                                                              */
/* -------------------------------------------------------------------------- */

function AuctionCard({
  auction: a, locale, tcd, ts, basePath,
}: {
  auction: AuctionDTO;
  locale: string;
  tcd: Awaited<ReturnType<typeof getTranslations>>;
  ts:  Awaited<ReturnType<typeof getTranslations>>;
  basePath: string;
}) {
  const fmt = new Intl.NumberFormat(locale, {
    style: 'currency', currency: a.currency, maximumFractionDigits: 0,
  });
  const endingSoon = a.status === 'LIVE' && new Date(a.endsAt).getTime() - Date.now() < 60 * 60_000;

  return (
    <Link
      href={`${basePath}/auctions/${a.slug}`}
      className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-xl"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
        {a.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={a.imageUrl} alt={a.title} loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300">
            <HammerIcon className="h-12 w-12" />
          </div>
        )}

        {/* Status pill */}
        <span className={`absolute start-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-md ${
          a.status === 'LIVE'      ? 'bg-emerald-500' :
          a.status === 'SCHEDULED' ? 'bg-sky-500'     :
          'bg-slate-700'
        }`}>
          {a.status === 'LIVE' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />}
          {ts(a.status)}
        </span>

        {/* Countdown badge */}
        {a.status === 'LIVE' && (
          <div className="absolute end-2 top-2 rounded-lg bg-black/60 px-2 py-1 backdrop-blur-sm">
            <CountdownTimer endsAt={a.endsAt} />
          </div>
        )}

        {/* Ending soon ribbon */}
        {endingSoon && (
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-rose-600/90 to-rose-600/0 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white">⚡ Ending soon</p>
          </div>
        )}

        {/* Reserve met badge */}
        {a.reserveMet && a.reservePrice !== null && a.currentBid > 0 && (
          <span className="absolute end-2 bottom-2 rounded-md bg-emerald-500 px-2 py-0.5 text-[9px] font-bold uppercase text-white shadow">
            ✓ Reserve
          </span>
        )}
      </div>

      <div className="space-y-2 p-4">
        <h3 className="line-clamp-2 min-h-[40px] text-sm font-semibold leading-tight text-[#0F172A] transition group-hover:text-[#F97316]">
          {a.title}
        </h3>
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {a.currentBid > 0 ? tcd('currentBid') : tcd('startingBid')}
          </span>
          <span className="text-lg font-black tabular-nums text-[#F97316]">
            {fmt.format(a.currentBid > 0 ? a.currentBid : a.startingBid)}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>{tcd('bidsCount', { count: a.bidCount })}</span>
          <span>{tcd('watchersCount', { count: a.watcherCount })}</span>
        </div>
        {a.supplierName && (
          <p className="flex items-center gap-1.5 truncate text-[11px] text-slate-400">
            {tcd('by', { name: a.supplierName })}
            {a.supplierVerified && (
              <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-white">
                <CheckIcon className="h-2.5 w-2.5" />
              </span>
            )}
          </p>
        )}
      </div>
    </Link>
  );
}

function EmptyState({
  locale, tab, hasFilters, te, hrefClear,
}: {
  locale: string;
  tab: string;
  hasFilters: boolean;
  te: Awaited<ReturnType<typeof getTranslations>>;
  hrefClear: string;
}) {
  if (hasFilters) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center sm:p-12">
        <h2 className="text-lg font-bold text-[#0F172A]">{te('noFilters')}</h2>
        <Link href={hrefClear}
          className="mt-4 inline-flex rounded-xl bg-[#0F172A] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800">
          {te('clearFilters')}
        </Link>
      </div>
    );
  }
  const titleKey = tab === 'upcoming' ? 'upcoming' : tab === 'ended' ? 'ended' : 'live';
  return (
    <div className="rounded-2xl border border-dashed border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50 p-8 text-center sm:p-12">
      <div className="mx-auto flex max-w-md flex-col items-center gap-4">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F97316] text-white shadow-md">
          <HammerIcon className="h-7 w-7" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-[#0F172A]">{te(titleKey)}</h2>
          <p className="mt-1 text-sm text-slate-600">{te(`${titleKey}Body` as 'liveBody')}</p>
        </div>
        <Link href={`/${locale}/contact?type=quote`}
          className="inline-flex items-center gap-2 rounded-xl bg-[#0F172A] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800">
          {te('requestQuote')}
        </Link>
      </div>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>;
}

