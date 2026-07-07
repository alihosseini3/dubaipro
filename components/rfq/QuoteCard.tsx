'use client';

import { useTranslations } from 'next-intl';

import { formatMoney } from '@/lib/rfq/format';
import type { RfqQuoteCard } from '@/lib/rfq/types';

const QUOTE_STATUS_STYLES = {
  DRAFT: 'bg-slate-100 text-slate-500',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  ACCEPTED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-600',
  WITHDRAWN: 'bg-slate-200 text-slate-400',
};

const TIER_STYLES = {
  STANDARD: 'bg-slate-100 text-slate-600',
  VERIFIED: 'bg-blue-100 text-blue-700',
  GUARANTEED: 'bg-amber-100 text-amber-700',
};

type Props = {
  quote: RfqQuoteCard;
  isBuyer: boolean;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  onWithdraw?: (id: string) => void;
  onMessage?: (id: string) => void;
  loading?: boolean;
};

export function QuoteCard({ quote, isBuyer, onAccept, onReject, onWithdraw, onMessage, loading }: Props) {
  const t = useTranslations('rfqMarketplace.quoteCard');
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* Supplier header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-rose-500 text-xs font-black text-white">
              {quote.supplierName.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <p className="text-sm font-bold text-slate-900">{quote.supplierName}</p>
              <p className="text-[11px] text-slate-500">{quote.supplierCountry}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${QUOTE_STATUS_STYLES[quote.status]}`}>
            {quote.status}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TIER_STYLES[quote.supplierTier]}`}>
            {quote.supplierTier}
          </span>
        </div>
      </div>

      {/* Stale warning */}
      {quote.isStale && quote.status === 'SUBMITTED' && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <p className="text-[11px] font-medium leading-snug text-amber-800">
            {isBuyer ? t('staleBuyer') : t('staleSupplier')}
          </p>
        </div>
      )}

      {/* Price block */}
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-2xl font-black text-orange-600">{formatMoney(quote.price, quote.currency)}</span>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t('perUnit')}</span>
      </div>

      {/* Details grid */}
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        {quote.moq && (
          <Stat label={t('moq')} value={`${quote.moq} ${t('pcs')}`} />
        )}
        {quote.leadTimeDays && (
          <Stat label={t('leadTime')} value={`${quote.leadTimeDays} ${t('days')}`} />
        )}
        {quote.shippingTerms && (
          <Stat label={t('shipping')} value={quote.shippingTerms} />
        )}
        {quote.paymentTerms && (
          <Stat label={t('payment')} value={quote.paymentTerms} />
        )}
        {quote.validUntil && (
          <Stat label={t('validUntil')} value={new Date(quote.validUntil).toLocaleDateString()} />
        )}
        {quote.supplierRating > 0 && (
          <Stat label={t('rating')} value={`★ ${quote.supplierRating.toFixed(1)}`} />
        )}
      </div>

      {/* Message preview */}
      {quote.message && (
        <p className="mt-3 line-clamp-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {quote.message}
        </p>
      )}

      {/* Actions */}
      {(isBuyer || onMessage || onWithdraw) && quote.status === 'SUBMITTED' && (
        <div className="mt-4 flex flex-wrap gap-2">
          {isBuyer && onAccept && (
            <button
              onClick={() => onAccept(quote.id)}
              disabled={loading}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {t('accept')}
            </button>
          )}
          {isBuyer && onReject && (
            <button
              onClick={() => onReject(quote.id)}
              disabled={loading}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
            >
              {t('reject')}
            </button>
          )}
          {!isBuyer && onWithdraw && (
            <button
              onClick={() => onWithdraw(quote.id)}
              disabled={loading}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-500 transition hover:border-red-200 hover:text-red-600 disabled:opacity-50"
            >
              {t('withdraw')}
            </button>
          )}
          {onMessage && (
            <button
              onClick={() => onMessage(quote.id)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-700"
            >
              {t('message')}
            </button>
          )}
        </div>
      )}
      {quote.status === 'ACCEPTED' && (
        <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {t('accepted')}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="font-semibold text-slate-700">{value}</p>
    </div>
  );
}
