'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

import { NegotiationChat } from '@/components/rfq/NegotiationChat';
import { QuoteCard } from '@/components/rfq/QuoteCard';
import { QuoteCompareTable } from '@/components/rfq/QuoteCompareTable';
import { QuoteSubmitModal } from '@/components/rfq/QuoteSubmitModal';
import { RfqStatusBadge, RfqUrgencyBadge } from '@/components/rfq/RfqStatusBadge';
import { formatMoney } from '@/lib/rfq/format';
import type { RfqQuoteCard, RfqRequestDetail } from '@/lib/rfq/types';
import { acceptQuoteAction, rejectQuoteAction, withdrawQuoteAction } from '../_actions';
import { useRfqUiStore } from '@/lib/stores/rfq-ui-store';
import { useRfqSse } from '@/hooks/use-rfq-sse';

/* ─────────────────────────────────────────────────────────────────────────── */
/* Types                                                                        */
/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * Dates in RfqRequestDetail become ISO strings after Next.js RSC serialization.
 * We alias them here so the component is explicit about what it receives.
 */
export type ClientRfqDetail = Omit<
  RfqRequestDetail,
  'createdAt' | 'expiresAt' | 'quotes'
> & {
  createdAt: string;
  expiresAt: string | null;
  quotes: (Omit<RfqQuoteCard, 'validUntil' | 'createdAt' | 'updatedAt'> & {
    validUntil: string | null;
    createdAt: string;
    updatedAt: string;
  })[];
};

type Props = {
  rfq: ClientRfqDetail;
  isBuyer: boolean;
  currentUserId: string | null;
  locale: string;
};

/* ─────────────────────────────────────────────────────────────────────────── */
/* Component                                                                    */
/* ─────────────────────────────────────────────────────────────────────────── */

export function RfqDetailClient({ rfq, isBuyer, currentUserId, locale }: Props) {
  const router = useRouter();
  const t = useTranslations('rfqMarketplace.detail');
  const addToast = useRfqUiStore((s) => s.addToast);

  const [actionLoading, setActionLoading] = useState(false);
  const [activeChat, setActiveChat] = useState<string | undefined>(undefined);
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const [showQuoteForm, setShowQuoteForm] = useState(false);

  // SSE — react to live RFQ/quote changes without polling
  useRfqSse(rfq.slug, useCallback((e) => {
    if (e.type === 'status_changed' || e.type === 'quote_update') {
      router.refresh();
    }
  }, [router]));

  const handleAccept = useCallback(async (quoteId: string) => {
    setActionLoading(true);
    try {
      const result = await acceptQuoteAction(quoteId, locale, rfq.slug);
      if (!result.ok) throw new Error(result.error);
      router.refresh();
      addToast({ kind: 'success', msg: t('quoteAccepted') });
    } catch {
      addToast({ kind: 'error', msg: t('acceptFailed') });
    } finally {
      setActionLoading(false);
    }
  }, [locale, rfq.slug, router, t]);

  const handleReject = useCallback(async (quoteId: string) => {
    setActionLoading(true);
    try {
      const result = await rejectQuoteAction(quoteId, locale, rfq.slug);
      if (!result.ok) throw new Error(result.error);
      router.refresh();
      addToast({ kind: 'success', msg: t('quoteRejected') });
    } catch {
      addToast({ kind: 'error', msg: t('rejectFailed') });
    } finally {
      setActionLoading(false);
    }
  }, [locale, rfq.slug, router, t]);

  const handleWithdraw = useCallback(async (quoteId: string) => {
    setActionLoading(true);
    try {
      const result = await withdrawQuoteAction(quoteId, locale, rfq.slug);
      if (!result.ok) throw new Error(result.error);
      router.refresh();
      addToast({ kind: 'success', msg: t('quoteWithdrawn') });
    } catch {
      addToast({ kind: 'error', msg: t('withdrawFailed') });
    } finally {
      setActionLoading(false);
    }
  }, [locale, rfq.slug, router, t]);

  const hasQuotes = rfq.quotes && rfq.quotes.length > 0;

  return (
    <div className="-mx-4 -my-10 md:-mx-6 lg:-mx-8">

      {/* ── Hero band ── */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-6 md:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav className="mb-4 flex items-center gap-1.5 text-xs text-slate-400">
            <Link href={`/${locale}/rfq`} className="transition hover:text-orange-500">
              RFQ Marketplace
            </Link>
            <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span className="max-w-[200px] truncate text-slate-600">{rfq.title}</span>
          </nav>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <RfqStatusBadge status={rfq.status} />
                <RfqUrgencyBadge urgency={rfq.urgency} />
                {rfq.categoryName && (
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
                    {rfq.categoryName}
                  </span>
                )}
              </div>
              <h1 className="mt-3 text-xl font-black text-slate-900 sm:text-2xl lg:text-3xl">
                {rfq.title}
              </h1>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {t('by')} <strong className="text-slate-700">{rfq.buyerName}</strong>
                </span>
                <span className="flex items-center gap-1">
                  <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {new Date(rfq.createdAt).toLocaleDateString()}
                </span>
                {rfq.expiresAt && (
                  <span className="flex items-center gap-1 text-amber-600">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {t('expiresIn', { date: new Date(rfq.expiresAt).toLocaleDateString() })}
                  </span>
                )}
              </p>
            </div>
            {/* CTA */}
            <div className="flex gap-2 sm:shrink-0">
              {!isBuyer && (rfq.status === 'OPEN' || rfq.status === 'NEGOTIATING') && (
                <button
                  onClick={() => setShowQuoteForm(true)}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 px-4 text-sm font-bold text-white shadow-md shadow-orange-200 transition hover:from-orange-600 hover:to-orange-700"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {t('submitQuote')}
                </button>
              )}
              {isBuyer && (
                <Link
                  href={`/${locale}/rfq/${rfq.slug}/edit`}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-orange-300"
                >
                  {t('editRfq')}
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="bg-slate-50">
        <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row">

            {/* ── Left column ── */}
            <div className="min-w-0 flex-1 space-y-5">

              {/* Spec grid */}
              <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <SpecCard label={t('quantity')} value={`${rfq.quantity} ${rfq.unit}`} />
                {rfq.targetPrice !== null && rfq.targetPrice !== undefined && (
                  <SpecCard label={t('budgetPerUnit')} value={formatMoney(rfq.targetPrice, rfq.currency)} highlight />
                )}
                <SpecCard label={t('destination')} value={rfq.shippingCountry} />
                <SpecCard label={t('quotesReceived')} value={String(rfq.quoteCount)} />
                <SpecCard label={t('views')} value={String(rfq.viewCount)} />
                {rfq.productRef && <SpecCard label={t('productRef')} value={rfq.productRef} />}
              </section>

              {/* Description */}
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
                  <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">{t('description')}</h2>
                </div>
                <div className="px-5 py-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{rfq.description}</p>
                </div>
              </section>

              {/* Sourcing notes */}
              {rfq.sourcingNotes && (
                <section className="overflow-hidden rounded-2xl border border-amber-100 bg-amber-50 shadow-sm">
                  <div className="border-b border-amber-100 px-5 py-3">
                    <h2 className="text-xs font-bold uppercase tracking-wide text-amber-700">{t('sourcingNotes')}</h2>
                  </div>
                  <div className="px-5 py-4">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-amber-900">{rfq.sourcingNotes}</p>
                  </div>
                </section>
              )}

              {/* Quotes */}
              {hasQuotes ? (
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-900">
                      {t('quotesCount', { count: rfq.quotes.length })}
                    </h2>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setView('cards')}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                          view === 'cards'
                            ? 'bg-orange-500 text-white'
                            : 'border border-slate-200 bg-white text-slate-600 hover:border-orange-300'
                        }`}
                      >
                        {t('viewCards')}
                      </button>
                      <button
                        onClick={() => setView('table')}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                          view === 'table'
                            ? 'bg-orange-500 text-white'
                            : 'border border-slate-200 bg-white text-slate-600 hover:border-orange-300'
                        }`}
                      >
                        {t('viewCompare')}
                      </button>
                    </div>
                  </div>
                  {view === 'table' ? (
                    <QuoteCompareTable
                      quotes={rfq.quotes as unknown as RfqQuoteCard[]}
                      onAccept={isBuyer ? handleAccept : undefined}
                      loading={actionLoading}
                    />
                  ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {rfq.quotes.map((q) => (
                        <QuoteCard
                          key={q.id}
                          quote={q as unknown as RfqQuoteCard}
                          isBuyer={isBuyer}
                          onAccept={isBuyer ? handleAccept : undefined}
                          onReject={isBuyer ? handleReject : undefined}
                          onWithdraw={!isBuyer && currentUserId ? handleWithdraw : undefined}
                          onMessage={() => setActiveChat(q.id)}
                          loading={actionLoading}
                        />
                      ))}
                    </div>
                  )}
                </section>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white py-14 text-center">
                  <svg className="h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  <p className="mt-3 text-sm font-semibold text-slate-500">{t('noQuotes')}</p>
                </div>
              )}

              {/* Chat */}
              {currentUserId && (isBuyer || rfq.quotes?.some((q) => q.supplierId)) && (
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3">
                    <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      {activeChat ? t('quoteNegotiation') : t('generalDiscussion')}
                    </h2>
                    {activeChat && (
                      <button
                        onClick={() => setActiveChat(undefined)}
                        className="text-[11px] font-semibold text-orange-500 hover:underline"
                      >
                        {t('backToChat')}
                      </button>
                    )}
                  </div>
                  <div className="p-4">
                    <NegotiationChat
                      rfqSlug={rfq.slug}
                      currentUserId={currentUserId}
                      quoteId={activeChat}
                    />
                  </div>
                </section>
              )}
            </div>

            {/* ── Right sidebar ── */}
            <aside className="w-full space-y-4 lg:sticky lg:top-20 lg:h-fit lg:w-64 lg:shrink-0">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    {t('rfqStats')}
                  </h3>
                </div>
                <div className="divide-y divide-slate-100 px-4">
                  <StatRow label={t('quotesReceived')} value={rfq.quoteCount} icon="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  <StatRow label={t('views')} value={rfq.viewCount} icon="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  <StatRow label={t('status')} value={rfq.status} icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  {rfq.expiresAt && (
                    <StatRow
                      label={t('expires')}
                      value={new Date(rfq.expiresAt).toLocaleDateString()}
                      icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  )}
                </div>
              </div>

              {!isBuyer && (rfq.status === 'OPEN' || rfq.status === 'NEGOTIATING') && (
                <button
                  onClick={() => setShowQuoteForm(true)}
                  className="group flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-200 transition hover:from-orange-600 hover:to-orange-700 hover:shadow-xl hover:shadow-orange-300"
                >
                  <svg className="h-4 w-4 transition group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {t('submitQuote')}
                </button>
              )}
            </aside>
          </div>
        </div>
      </div>

      <QuoteSubmitModal
        open={showQuoteForm && !isBuyer && (rfq.status === 'OPEN' || rfq.status === 'NEGOTIATING')}
        onClose={() => setShowQuoteForm(false)}
        slug={rfq.slug}
        rfqQuantity={rfq.quantity}
        rfqUnit={rfq.unit}
        rfqCurrency={rfq.currency}
        rfqTargetPrice={rfq.targetPrice}
        onSuccess={() => {
          setShowQuoteForm(false);
          router.refresh();
          addToast({ kind: 'success', msg: t('quoteSuccess') });
        }}
        onError={(msg) => addToast({ kind: 'error', msg })}
      />

    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Sub-components                                                               */
/* ─────────────────────────────────────────────────────────────────────────── */

function SpecCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-3.5 ${highlight ? 'border-orange-200 bg-orange-50' : 'border-slate-200 bg-white'}`}>
      <p className={`text-[10px] font-bold uppercase tracking-wider ${highlight ? 'text-orange-400' : 'text-slate-400'}`}>
        {label}
      </p>
      <p className={`mt-1 text-sm font-bold ${highlight ? 'text-orange-600' : 'text-slate-800'}`}>
        {value}
      </p>
    </div>
  );
}

function StatRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: string;
}) {
  return (
    <div className="flex items-center justify-between py-3 text-xs">
      <span className="flex items-center gap-2 text-slate-500">
        <svg className="h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
        {label}
      </span>
      <span className="font-bold text-slate-800">{value}</span>
    </div>
  );
}
