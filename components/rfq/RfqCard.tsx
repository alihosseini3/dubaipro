import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { expiresInDays, formatMoney } from '@/lib/rfq/format';
import type { RfqRequestCard } from '@/lib/rfq/types';

import { RfqStatusBadge, RfqUrgencyBadge } from './RfqStatusBadge';

const URGENCY_ACCENT: Record<string, string> = {
  ASAP: 'border-s-red-400',
  URGENT: 'border-s-amber-400',
  STANDARD: 'border-s-slate-200',
};

export function RfqCard({ rfq, locale }: { rfq: RfqRequestCard; locale: string }) {
  const t = useTranslations('rfqMarketplace.card');
  const expiry = expiresInDays(rfq.expiresAt);
  const accentBorder = URGENCY_ACCENT[rfq.urgency] ?? 'border-s-slate-200';

  return (
    <Link
      href={`/${locale}/rfq/${rfq.slug}`}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 border-s-4 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200/80 ${accentBorder}`}
    >
      {/* Top section */}
      <div className="flex flex-1 flex-col gap-3 p-5">
        {/* Badges row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <RfqStatusBadge status={rfq.status} />
            <RfqUrgencyBadge urgency={rfq.urgency} />
          </div>
          {expiry && !expiry.expired && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${expiry.days <= 2 ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
              {t('daysLeft', { days: expiry.days })}
            </span>
          )}
          {expiry?.expired && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-400">{t('expired')}</span>
          )}
        </div>

        {/* Title */}
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-slate-900 transition-colors group-hover:text-orange-600">
          {rfq.title}
        </h3>

        {/* Category chip */}
        {rfq.categoryName && (
          <span className="inline-flex w-fit items-center rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
            {rfq.categoryName}
          </span>
        )}

        {/* Key metrics */}
        <div className="mt-auto grid grid-cols-2 gap-2 pt-1">
          <div className="flex flex-col rounded-xl bg-slate-50 px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t('qty')}</span>
            <span className="mt-0.5 text-sm font-bold text-slate-800">{rfq.quantity} <span className="font-normal text-slate-500">{rfq.unit}</span></span>
          </div>
          {rfq.targetPrice !== null && rfq.targetPrice !== undefined ? (
            <div className="flex flex-col rounded-xl bg-orange-50 px-3 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-orange-400">{t('budget')}</span>
              <span className="mt-0.5 text-sm font-bold text-orange-600">{formatMoney(rfq.targetPrice, rfq.currency)}</span>
            </div>
          ) : (
            <div className="flex flex-col rounded-xl bg-slate-50 px-3 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t('shipTo')}</span>
              <span className="mt-0.5 text-sm font-bold text-slate-700">{rfq.shippingCountry}</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-5 py-3">
        <span className="max-w-[120px] truncate text-[11px] font-medium text-slate-500">{rfq.buyerName}</span>
        <div className="flex items-center gap-3">
          {/* Quote count */}
          <span className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">
            <svg className="h-3 w-3 text-orange-500" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
              <path d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7z"/>
            </svg>
            {rfq.quoteCount}
          </span>
          <span className="text-[11px] text-slate-400">{new Date(rfq.createdAt).toLocaleDateString(locale)}</span>
        </div>
      </div>
    </Link>
  );
}
