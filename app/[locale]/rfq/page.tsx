import Link from 'next/link';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { getCurrentUser } from '@/lib/auth/session';
import type { RfqUrgency } from '@prisma/client';

import { listRfqs } from '@/lib/rfq/service';
import { prisma } from '@/lib/prisma';
import { RfqCard } from '@/components/rfq/RfqCard';

export const metadata: Metadata = {
  title: 'RFQ Marketplace | DubaiPro',
  description: 'Browse sourcing requests from global buyers. Submit competitive quotes.',
};

export default async function RfqListPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: 'rfqMarketplace' });

  const user = await getCurrentUser();
  const page = Math.max(1, Number(sp.page) || 1);

  const [{ items, total }, supplierCount, categories] = await Promise.all([
    listRfqs(
      { page, limit: 24, search: sp.q, categoryId: sp.category, urgency: sp.urgency as RfqUrgency | undefined },
      user?.id,
      user?.role === 'ADMIN'
    ),
    prisma.supplier.count({ where: { verified: true } }).catch(() => 0),
    prisma.category.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }).catch(() => []),
  ]);

  const totalPages = Math.ceil(total / 24);
  const hasFilters = Boolean(sp.q || sp.urgency || sp.category);

  return (
    <div className="-mx-4 -my-10 md:-mx-6 lg:-mx-8">

      {/* ═══════════════════ HERO ═══════════════════ */}
      <section className="relative overflow-hidden bg-[#0f172a]">
        {/* Subtle grid pattern */}
        <div aria-hidden className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px)', backgroundSize: '40px 40px' }} />
        {/* Glow blobs */}
        <div aria-hidden className="pointer-events-none absolute -top-32 -end-32 h-96 w-96 rounded-full bg-orange-500/20 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute bottom-0 start-0 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative mx-auto max-w-[1400px] px-4 pt-12 pb-0 md:px-6 md:pt-16 lg:px-8">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">

            {/* Left copy */}
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-400/30 bg-orange-500/10 px-3 py-1">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-400" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-orange-300">{t('eyebrow')}</span>
              </div>
              <h1 className="mt-5 text-4xl font-black leading-[1.1] tracking-tight text-white md:text-5xl">
                {t('title')}
              </h1>
              <p className="mt-3 text-base text-slate-400 md:text-lg">
                {t('openCount', { count: total })}
              </p>

              {/* Trust bar */}
              <div className="mt-5 flex flex-wrap items-center gap-4">
                {[
                  { icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', label: t('trustVerified') },
                  { icon: 'M13 10V3L4 14h7v7l9-11h-7z', label: t('trustFast') },
                  { icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z', label: t('trustSecure') },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-1.5 text-[12px] font-medium text-slate-400">
                    <svg className="h-3.5 w-3.5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={item.icon}/></svg>
                    {item.label}
                  </div>
                ))}
              </div>

              {/* CTA row */}
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href={user ? `/${locale}/rfq/create` : `/${locale}/login?next=/${locale}/rfq/create`}
                  className="inline-flex h-12 items-center gap-2 rounded-xl bg-orange-500 px-6 text-sm font-bold text-white shadow-[0_8px_30px_rgba(249,115,22,0.45)] transition hover:-translate-y-0.5 hover:bg-orange-600 hover:shadow-[0_12px_36px_rgba(249,115,22,0.5)]"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  {t('postRfq')}
                </Link>
                {user && (
                  <Link
                    href={`/${locale}/supplier/rfq`}
                    className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/></svg>
                    {t('inbox')}
                  </Link>
                )}
              </div>
            </div>

            {/* Stats panel */}
            <div className="flex shrink-0 flex-col gap-px overflow-hidden rounded-t-2xl border border-white/10 bg-white/5 backdrop-blur sm:flex-row lg:mb-0">
              <StatBox icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" label={t('statTotal')} value={total.toLocaleString(locale)} accent />
              <StatBox icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" label={t('statSuppliers')} value={supplierCount.toLocaleString(locale)} />
              <StatBox icon="M13 10V3L4 14h7v7l9-11h-7z" label={t('statResponse')} value={t('statResponseValue')} />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ BODY ═══════════════════ */}
      <div className="bg-slate-50">
        <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-6 lg:px-8">

          {/* Filter bar */}
          <form method="get" className="mb-8 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm">
            <div className="relative min-w-[200px] flex-1">
              <svg viewBox="0 0 24 24" className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" strokeLinecap="round" />
              </svg>
              <input name="q" defaultValue={sp.q} placeholder={t('searchPlaceholder')}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 ps-9 pe-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-100"
              />
            </div>
            <select name="urgency" defaultValue={sp.urgency ?? ''}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 focus:border-orange-400 focus:outline-none">
              <option value="">{t('allUrgencies')}</option>
              <option value="STANDARD">{t('urgency.STANDARD')}</option>
              <option value="URGENT">{t('urgency.URGENT')}</option>
              <option value="ASAP">{t('urgency.ASAP')}</option>
            </select>
            {categories.length > 0 && (
              <select name="category" defaultValue={sp.category ?? ''}
                className="h-10 max-w-[200px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 focus:border-orange-400 focus:outline-none">
                <option value="">{t('create.placeholderCategory')}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
            <button type="submit"
              className="h-10 rounded-xl bg-orange-500 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-orange-600">
              {t('filter')}
            </button>
            {hasFilters && (
              <Link href={`/${locale}/rfq`}
                className="inline-flex h-10 items-center rounded-xl px-3 text-sm font-medium text-slate-500 hover:text-slate-900">
                {t('reset')}
              </Link>
            )}
          </form>

          {/* Grid */}
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-white py-28 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                  <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" strokeLinecap="round" />
                </svg>
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-700">{t('noResults')}</p>
              <p className="mt-1 text-xs text-slate-400">{t('postRfq')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((rfq) => <RfqCard key={rfq.id} rfq={rfq} locale={locale} />)}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-10 flex justify-center gap-2">
              {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map((p) => {
                const qs = new URLSearchParams();
                qs.set('page', String(p));
                if (sp.q) qs.set('q', sp.q);
                if (sp.urgency) qs.set('urgency', sp.urgency);
                if (sp.category) qs.set('category', sp.category);
                return (
                  <Link key={p}
                    href={`?${qs.toString()}`}
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-xl text-sm font-semibold transition ${
                      p === page
                        ? 'bg-orange-500 text-white shadow-[0_4px_12px_rgba(249,115,22,0.35)]'
                        : 'border border-slate-200 bg-white text-slate-700 hover:border-orange-300'
                    }`}
                  >{p}</Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBox({ icon, label, value, accent }: { icon: string; label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex min-w-[140px] flex-col gap-3 px-6 py-5">
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${accent ? 'bg-orange-500/20' : 'bg-white/8'}`}>
        <svg className={`h-4 w-4 ${accent ? 'text-orange-400' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      </div>
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
        <div className={`mt-0.5 text-2xl font-black ${accent ? 'text-orange-400' : 'text-white'}`}>{value}</div>
      </div>
    </div>
  );
}
