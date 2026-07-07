import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import type { RfqRequestStatus } from '@prisma/client';

import { requireUser } from '@/lib/auth/require-user';
import { prisma } from '@/lib/prisma';
import { listRfqs } from '@/lib/rfq/service';
import { MyRfqCard } from '@/components/rfq/MyRfqCard';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string>>;
};

/** Tabs shown in the buyer dashboard (in display order). */
const TAB_STATUSES: RfqRequestStatus[] = [
  'DRAFT',
  'PENDING_REVIEW',
  'OPEN',
  'NEGOTIATING',
  'QUOTED',
  'ACCEPTED',
  'EXPIRED',
  'CANCELLED',
];

const ALL_STATUSES = new Set<string>([
  ...TAB_STATUSES,
  'FULFILLED',
  'CLOSED',
]);

const PAGE_SIZE = 12;

export default async function MyRfqsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  const user = await requireUser(locale, '/account/rfq');
  const t = await getTranslations({ locale, namespace: 'rfqMarketplace.myRfqsPage' });

  const status = ALL_STATUSES.has(sp.status) ? (sp.status as RfqRequestStatus) : undefined;
  const search = sp.q?.trim() || undefined;
  const page = Math.max(1, Number(sp.page) || 1);

  const [{ items, total }, grouped] = await Promise.all([
    listRfqs({ userId: user.id, status, search, page, limit: PAGE_SIZE }, user.id, false),
    prisma.rfqRequest.groupBy({
      by: ['status'],
      where: { userId: user.id },
      _count: { id: true },
    }),
  ]);

  const counts = Object.fromEntries(grouped.map((g) => [g.status, g._count.id]));
  const totalAll = grouped.reduce((sum, g) => sum + g._count.id, 0);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const buildHref = (next: Record<string, string | undefined>) => {
    const qs = new URLSearchParams();
    const merged = { status: sp.status, q: search, page: undefined, ...next };
    for (const [k, v] of Object.entries(merged)) {
      if (v) qs.set(k, v);
    }
    const s = qs.toString();
    return s ? `?${s}` : '?';
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>
        </div>
        <Link
          href={`/${locale}/rfq/create`}
          className="inline-flex h-10 w-fit items-center gap-2 rounded-xl bg-orange-500 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-orange-600"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
          {t('newRfq')}
        </Link>
      </header>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-2">
        <Link
          href={buildHref({ status: undefined })}
          className={tabClass(!status)}
        >
          {t('tabAll')} <span className="ms-1 opacity-60">{totalAll}</span>
        </Link>
        {TAB_STATUSES.map((s) => (
          <Link key={s} href={buildHref({ status: s })} className={tabClass(status === s)}>
            {t(`status.${s}`)} <span className="ms-1 opacity-60">{counts[s] ?? 0}</span>
          </Link>
        ))}
      </div>

      {/* Search */}
      <form method="get" className="flex gap-2">
        {status && <input type="hidden" name="status" value={status} />}
        <div className="relative flex-1">
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            name="q"
            defaultValue={search}
            placeholder={t('searchPlaceholder')}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white ps-9 pe-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
          />
        </div>
        <button type="submit" className="h-10 rounded-xl bg-slate-900 px-5 text-sm font-bold text-white transition hover:bg-slate-800">
          {t('searchBtn')}
        </button>
      </form>

      {/* Grid */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white py-16 text-center">
          <svg className="h-9 w-9 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="mt-3 text-sm font-semibold text-slate-600">{t('empty')}</p>
          <Link href={`/${locale}/rfq/create`} className="mt-4 inline-flex items-center rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-700">
            {t('newRfq')}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((rfq) => <MyRfqCard key={rfq.id} rfq={rfq} locale={locale} />)}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={buildHref({ page: String(p) })}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold transition ${
                p === page
                  ? 'bg-orange-500 text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:border-orange-300'
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function tabClass(active: boolean) {
  return `inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold transition ${
    active
      ? 'bg-orange-500 text-white shadow-sm'
      : 'border border-slate-200 bg-white text-slate-600 hover:border-orange-300'
  }`;
}
