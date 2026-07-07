'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { expiresInDays, formatMoney } from '@/lib/rfq/format';
import type { RfqRequestCard } from '@/lib/rfq/types';

import { RfqStatusBadge, RfqUrgencyBadge } from './RfqStatusBadge';

/** Statuses where the buyer may still edit the RFQ. */
const EDITABLE = new Set(['DRAFT', 'PENDING_REVIEW', 'OPEN', 'QUOTED', 'NEGOTIATING']);
/** Statuses where the buyer may cancel the RFQ. */
const CANCELLABLE = new Set(['DRAFT', 'PENDING_REVIEW', 'OPEN', 'QUOTED', 'NEGOTIATING']);

export function MyRfqCard({ rfq, locale }: { rfq: RfqRequestCard; locale: string }) {
  const t = useTranslations('rfqMarketplace.myRfqsPage');
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const expiry = expiresInDays(rfq.expiresAt);

  async function cancel() {
    if (cancelling) return;
    if (!window.confirm(t('confirmCancel'))) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/rfq/requests/${rfq.slug}`, { method: 'DELETE' });
      if (res.ok) router.refresh();
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <div className="flex flex-1 flex-col gap-3 p-5">
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
        </div>

        <Link
          href={`/${locale}/rfq/${rfq.slug}`}
          className="line-clamp-2 text-sm font-bold leading-snug text-slate-900 transition-colors hover:text-orange-600"
        >
          {rfq.title}
        </Link>

        {rfq.categoryName && (
          <span className="inline-flex w-fit items-center rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
            {rfq.categoryName}
          </span>
        )}

        <div className="mt-auto grid grid-cols-3 gap-2 pt-1">
          <Metric label={t('qty')} value={`${rfq.quantity} ${rfq.unit}`} />
          <Metric
            label={t('budget')}
            value={rfq.targetPrice != null ? formatMoney(rfq.targetPrice, rfq.currency) : '—'}
            accent={rfq.targetPrice != null}
          />
          <Metric label={t('quotes')} value={String(rfq.quoteCount)} />
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-2.5">
        <span className="text-[11px] text-slate-400">
          {new Date(rfq.createdAt).toLocaleDateString(locale)}
        </span>
        <div className="flex items-center gap-1.5">
          <Link
            href={`/${locale}/rfq/${rfq.slug}`}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-orange-300 hover:text-orange-600"
          >
            {t('view')}
          </Link>
          {EDITABLE.has(rfq.status) && (
            <Link
              href={`/${locale}/rfq/${rfq.slug}/edit`}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-orange-300 hover:text-orange-600"
            >
              {t('edit')}
            </Link>
          )}
          {CANCELLABLE.has(rfq.status) && (
            <button
              type="button"
              onClick={cancel}
              disabled={cancelling}
              className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
            >
              {cancelling ? '…' : t('cancel')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`flex flex-col rounded-xl px-3 py-2 ${accent ? 'bg-orange-50' : 'bg-slate-50'}`}>
      <span className={`text-[10px] font-semibold uppercase tracking-wide ${accent ? 'text-orange-400' : 'text-slate-400'}`}>
        {label}
      </span>
      <span className={`mt-0.5 truncate text-sm font-bold ${accent ? 'text-orange-600' : 'text-slate-800'}`}>
        {value}
      </span>
    </div>
  );
}
