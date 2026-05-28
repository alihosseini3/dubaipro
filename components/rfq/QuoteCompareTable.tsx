'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import { formatMoney } from '@/lib/rfq/format';
import type { RfqQuoteCard } from '@/lib/rfq/types';

type SortKey = 'price' | 'lead' | 'rating';

type Props = {
  quotes: RfqQuoteCard[];
  onAccept?: (id: string) => void;
  loading?: boolean;
};

export function QuoteCompareTable({ quotes, onAccept, loading }: Props) {
  const t = useTranslations('rfqMarketplace.compareTable');
  const tQc = useTranslations('rfqMarketplace.quoteCard');
  const [sortKey, setSortKey] = useState<SortKey>('price');

  const active = useMemo(() => quotes.filter((q) => q.status !== 'WITHDRAWN'), [quotes]);

  const sorted = useMemo(() => {
    const arr = [...active];
    arr.sort((a, b) => {
      if (sortKey === 'price') return a.price - b.price;
      if (sortKey === 'lead') return (a.leadTimeDays ?? 999) - (b.leadTimeDays ?? 999);
      return b.supplierRating - a.supplierRating;
    });
    return arr;
  }, [active, sortKey]);

  if (active.length === 0) return null;

  const minPrice = Math.min(...active.map((q) => q.price));

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {/* Sort toolbar */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          {t('activeQuotes', { count: active.length })}
        </p>
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-bold uppercase text-slate-400">{t('sort')}:</span>
          {([
            { id: 'price', label: t('sortPrice') },
            { id: 'lead', label: t('sortLead') },
            { id: 'rating', label: t('sortRating') },
          ] as const).map((s) => (
            <button
              key={s.id}
              onClick={() => setSortKey(s.id)}
              className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                sortKey === s.id ? 'bg-orange-500 text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            <Th>{t('supplier')}</Th>
            <Th>{t('price')}</Th>
            <Th>{t('moq')}</Th>
            <Th>{t('leadTime')}</Th>
            <Th>{t('shipping')}</Th>
            <Th>{t('payment')}</Th>
            <Th>{t('rating')}</Th>
            <Th>{t('status')}</Th>
            {onAccept && <Th>{t('action')}</Th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map((q) => {
            const isBest = q.price === minPrice;
            return (
              <tr
                key={q.id}
                className={`transition hover:bg-slate-50 ${
                  isBest ? 'ring-1 ring-inset ring-orange-300' : ''
                }`}
              >
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 to-rose-500 text-[10px] font-black text-white">
                      {q.supplierName.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900">{q.supplierName}</p>
                      <p className="text-[10px] text-slate-400">{q.supplierCountry}</p>
                    </div>
                    {isBest && (
                      <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
                        {t('best')}
                      </span>
                    )}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-black text-orange-600">
                  {formatMoney(q.price, q.currency)}
                </td>
                <Td>{q.moq ? `${q.moq} ${tQc('pcs')}` : '—'}</Td>
                <Td>{q.leadTimeDays ? `${q.leadTimeDays}${tQc('days').charAt(0)}` : '—'}</Td>
                <Td>{q.shippingTerms ?? '—'}</Td>
                <Td>{q.paymentTerms ?? '—'}</Td>
                <td className="whitespace-nowrap px-4 py-3 text-amber-600">
                  {q.supplierRating > 0 ? `★ ${q.supplierRating.toFixed(1)}` : '—'}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <StatusPill status={q.status} />
                </td>
                {onAccept && (
                  <td className="whitespace-nowrap px-4 py-3">
                    {q.status === 'SUBMITTED' && (
                      <button
                        onClick={() => onAccept(q.id)}
                        disabled={loading}
                        className="inline-flex h-7 items-center rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {t('accept')}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
      {children}
    </td>
  );
}

const PILL = {
  DRAFT: 'bg-slate-100 text-slate-500',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  ACCEPTED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-600',
  WITHDRAWN: 'bg-slate-200 text-slate-400',
} as const;

function StatusPill({ status }: { status: keyof typeof PILL }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${PILL[status]}`}>
      {status}
    </span>
  );
}
