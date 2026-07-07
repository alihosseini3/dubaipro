import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

import { RfqStatusBadge, RfqUrgencyBadge } from '@/components/rfq/RfqStatusBadge';
import { formatMoney } from '@/lib/rfq/format';

export const metadata: Metadata = {
  title: 'RFQ Inbox | Supplier Dashboard',
  description: 'Manage incoming RFQ requests and submit quotes.',
};

type Tab = 'invited' | 'active' | 'recommended';

// Module-level selects so sub-components can use Prisma-derived types
const CARD_SEL = {
  id: true, slug: true, title: true, quantity: true, unit: true,
  targetPrice: true, currency: true, shippingCountry: true,
  urgency: true, status: true, quoteCount: true, expiresAt: true, createdAt: true,
  user: { select: { name: true } },
  category: { select: { name: true } },
} as const;
const INVITE_SEL = { id: true, invitedAt: true, viewedAt: true, rfq: { select: CARD_SEL } } as const;
const QUOTE_ACT_SEL = {
  id: true, status: true, price: true, currency: true, updatedAt: true,
  rfq: { select: CARD_SEL },
} as const;

type RfqCardData = Prisma.RfqRequestGetPayload<{ select: typeof CARD_SEL }>;
type InviteData = Prisma.RfqSupplierInviteGetPayload<{ select: typeof INVITE_SEL }>;
type QuoteActData = Prisma.RfqQuoteGetPayload<{ select: typeof QUOTE_ACT_SEL }>;

export default async function SupplierRfqInbox({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const tab = (sp.tab ?? 'invited') as Tab;
  const t = await getTranslations({ locale, namespace: 'rfqMarketplace.supplier' });
  const tCard = await getTranslations({ locale, namespace: 'rfqMarketplace.card' });

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== 'SUPPLIER' && user.role !== 'ADMIN') redirect(`/${locale}`);

  const supplier = await prisma.supplier.findUnique({
    where: { userId: user.id },
    select: { id: true, status: true, name: true },
  });
  if (!supplier) redirect(`/${locale}`);

  // Counts per tab for badges
  const [invitedCount, activeCount] = await Promise.all([
    prisma.rfqSupplierInvite.count({ where: { supplierId: supplier.id, viewedAt: null } }),
    prisma.rfqQuote.count({ where: { supplierId: supplier.id, status: { notIn: ['WITHDRAWN'] } } }),
  ]);

  // Load data server-side per tab

  let invited: InviteData[] = [];
  let active: QuoteActData[] = [];
  let recommended: RfqCardData[] = [];

  if (tab === 'invited') {
    invited = await prisma.rfqSupplierInvite.findMany({
      where: { supplierId: supplier.id },
      select: INVITE_SEL,
      orderBy: { invitedAt: 'desc' },
      take: 30,
    });
  } else if (tab === 'active') {
    active = await prisma.rfqQuote.findMany({
      where: { supplierId: supplier.id, status: { notIn: ['WITHDRAWN'] } },
      select: QUOTE_ACT_SEL,
      orderBy: { updatedAt: 'desc' },
      take: 30,
    });
  } else {
    // recommended: open RFQs matching supplier's category mix
    const products = await prisma.product.findMany({
      where: { supplierId: supplier.id },
      select: { categoryId: true },
      take: 50,
    });
    const catIds = [...new Set(products.map((p) => p.categoryId))];
    recommended = await prisma.rfqRequest.findMany({
      where: {
        status: { in: ['OPEN', 'NEGOTIATING'] },
        visibility: { not: 'PRIVATE' },
        ...(catIds.length > 0 ? { categoryId: { in: catIds } } : {}),
      },
      select: CARD_SEL,
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
  }

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: 'invited', label: t('invited'), count: invitedCount },
    { id: 'active', label: t('myQuotes'), count: activeCount },
    { id: 'recommended', label: t('recommended') },
  ];

  return (
    <div className="-m-4 sm:-m-6 lg:-m-8">
      {/* Hero band */}
      <div className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800">
        <div aria-hidden className="pointer-events-none absolute -top-24 -end-24 h-72 w-72 rounded-full bg-orange-500/20 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-20 start-0 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="relative mx-auto max-w-5xl px-4 py-10 md:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-400/30 bg-orange-500/10 px-3 py-1">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-400" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-orange-300">{t('eyebrow')}</span>
          </div>
          <h1 className="mt-4 text-2xl font-black tracking-tight text-white sm:text-3xl">{t('title')}</h1>
          <p className="mt-1 text-sm text-slate-300">
            <span className="font-semibold text-white">{supplier.name}</span>
            <span className="mx-2 text-slate-500">·</span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-200">{supplier.status}</span>
          </p>
        </div>
      </div>

      <main className="bg-slate-50">
        <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 lg:px-8">
          {/* Tabs */}
          <div className="mb-6 flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {TABS.map((tab2) => (
              <Link
                key={tab2.id}
                href={`?tab=${tab2.id}`}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-center text-xs font-bold uppercase tracking-wide transition ${
                  tab === tab2.id
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                {tab2.label}
                {tab2.count !== undefined && tab2.count > 0 && (
                  <span className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                    tab === tab2.id ? 'bg-white/25 text-white' : 'bg-orange-100 text-orange-600'
                  }`}>
                    {tab2.count}
                  </span>
                )}
              </Link>
            ))}
          </div>

          {/* Content */}
          {tab === 'invited' && (
            <InviteList invites={invited} locale={locale} supplierId={supplier.id} emptyMsg={t('noInvites')} newLabel={t('badgeNew')} metaInvited={(d) => t('metaInvited', { date: d })} tCardLabels={{ budget: tCard('budget') }} />
          )}
          {tab === 'active' && (
            <ActiveQuoteList quotes={active} locale={locale} emptyMsg={t('noQuotes')} acceptedLabel={t('badgeAccepted')} tCardLabels={{ budget: tCard('budget') }} />
          )}
          {tab === 'recommended' && (
            <RfqGrid rfqs={recommended} locale={locale} emptyMsg={t('noRecommended')} tCardLabels={{ budget: tCard('budget') }} />
          )}
        </div>
      </main>
    </div>
  );
}

type CardLabels = { budget: string };

function InviteList({
  invites, locale, emptyMsg, newLabel, metaInvited, tCardLabels,
}: {
  invites: InviteData[];
  locale: string;
  supplierId: string;
  emptyMsg: string;
  newLabel: string;
  metaInvited: (date: string) => string;
  tCardLabels: CardLabels;
}) {
  if (invites.length === 0) return <EmptyState message={emptyMsg} />;
  return (
    <div className="space-y-3">
      {invites.map((inv) => (
        <RfqInboxCard
          key={inv.id}
          rfq={inv.rfq}
          locale={locale}
          badge={inv.viewedAt ? undefined : newLabel}
          badgeKind="new"
          meta={metaInvited(new Date(inv.invitedAt).toLocaleDateString(locale))}
          labels={tCardLabels}
        />
      ))}
    </div>
  );
}

function ActiveQuoteList({
  quotes, locale, emptyMsg, acceptedLabel, tCardLabels,
}: {
  quotes: QuoteActData[];
  locale: string;
  emptyMsg: string;
  acceptedLabel: string;
  tCardLabels: CardLabels;
}) {
  if (quotes.length === 0) return <EmptyState message={emptyMsg} />;
  return (
    <div className="space-y-3">
      {quotes.map((q) => (
        <RfqInboxCard
          key={q.id}
          rfq={q.rfq}
          locale={locale}
          badge={q.status === 'ACCEPTED' ? acceptedLabel : undefined}
          badgeKind="accepted"
          meta={`${formatMoney(Number(q.price), q.currency)} · ${q.status}`}
          labels={tCardLabels}
        />
      ))}
    </div>
  );
}

function RfqGrid({
  rfqs, locale, emptyMsg, tCardLabels,
}: {
  rfqs: RfqCardData[];
  locale: string;
  emptyMsg: string;
  tCardLabels: CardLabels;
}) {
  if (rfqs.length === 0) return <EmptyState message={emptyMsg} />;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {rfqs.map((rfq) => (
        <RfqInboxCard key={rfq.id} rfq={rfq} locale={locale} labels={tCardLabels} />
      ))}
    </div>
  );
}

function RfqInboxCard({
  rfq,
  locale,
  badge,
  badgeKind,
  meta,
  labels,
}: {
  rfq: RfqCardData;
  locale: string;
  badge?: string;
  badgeKind?: 'new' | 'accepted';
  meta?: string;
  labels: CardLabels;
}) {
  return (
    <Link
      href={`/${locale}/rfq/${rfq.slug}`}
      className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md"
    >
      {/* Left indicator */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-100 to-orange-50 text-orange-600">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-sm font-bold text-slate-900 transition group-hover:text-orange-700">
            {rfq.title}
          </h3>
          <RfqStatusBadge status={rfq.status} />
          <RfqUrgencyBadge urgency={rfq.urgency} />
          {badge && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
              badgeKind === 'accepted' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'
            }`}>
              {badge}
            </span>
          )}
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          {rfq.quantity} {rfq.unit} · {rfq.shippingCountry}
          {rfq.targetPrice !== null && rfq.targetPrice !== undefined && ` · ${labels.budget}: ${formatMoney(Number(rfq.targetPrice), rfq.currency)}`}
          {meta && ` · ${meta}`}
        </p>
      </div>

      {/* Arrow */}
      <svg className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-orange-500 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-500">{message}</p>
    </div>
  );
}
