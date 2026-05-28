'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import type { AuctionBidEvent } from '@/lib/auctions/emitter';
import type { AuctionDetailDTO } from '@/lib/auctions/service';
import { useAuctionRealtime } from '@/lib/auctions/useAuctionRealtime';

type Bid = AuctionDetailDTO['recentBids'][number];

type Props = {
  auction: AuctionDetailDTO;
  locale: string;
  /** Which sub-panel to render. Defaults to 'both'. */
  mode?: 'both' | 'chart' | 'history';
  className?: string;
};

function fmt(amount: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

export function AuctionTradingWorkspace({ auction, locale, mode = 'both', className }: Props) {
  const t = useTranslations('auctions.detail');
  const tb = useTranslations('auctions.bidsPage');
  const [currentBid, setCurrentBid] = useState(auction.currentBid);
  const [totalBids, setTotalBids] = useState(auction.bidCount);
  const [bids, setBids] = useState<Bid[]>(auction.recentBids);
  const [pulse, setPulse] = useState(false);

  const handleBid = useCallback((ev: AuctionBidEvent) => {
      const now = new Date().toISOString();
      setCurrentBid(ev.currentBid);
      setTotalBids(ev.totalBids);
      setBids((prev) => [{
        id: `live-${Date.now()}`,
        amount: ev.currentBid,
        currency: auction.currency,
        createdAt: now,
        bidderInitial: ev.bidderInitial,
      }, ...prev].slice(0, 25));
      setPulse(true);
      window.setTimeout(() => setPulse(false), 700);
  }, [auction.id, auction.status, auction.currency]);

  const realtimeHandlers = useMemo(() => ({ onBid: handleBid }), [handleBid]);
  useAuctionRealtime(auction.id, auction.status === 'LIVE', realtimeHandlers);

  const series = useMemo(() => {
    const sorted = [...bids].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const values = sorted.length > 0 ? sorted.map((b) => b.amount) : [auction.startingBid, currentBid || auction.startingBid];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(1, max - min);
    return values.map((value, index) => ({
      x: values.length === 1 ? 0 : (index / (values.length - 1)) * 100,
      y: 92 - ((value - min) / range) * 74,
      value,
    }));
  }, [bids, auction.startingBid, currentBid]);

  const path = series.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');

  const reservePoint = auction.reservePrice && series.length > 0
    ? (() => {
        const values = series.map((p) => p.value);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const range = Math.max(1, max - min);
        return 92 - ((auction.reservePrice - min) / range) * 74;
      })()
    : null;

  function relativeTime(iso: string) {
    const diff = Math.max(0, Date.now() - new Date(iso).getTime());
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return t('justNow');
    const min = Math.floor(sec / 60);
    if (min < 60) return t('minutesAgo', { minutes: min });
    const hr = Math.floor(min / 60);
    if (hr < 24) return t('hoursAgo', { hours: hr });
    return t('daysAgo', { days: Math.floor(hr / 24) });
  }

  const avatarColors = [
    'from-orange-400 to-orange-600',
    'from-emerald-400 to-emerald-600',
    'from-sky-400 to-sky-600',
    'from-rose-400 to-rose-600',
    'from-violet-400 to-violet-600',
    'from-amber-400 to-amber-600',
  ];

  const chart = (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-orange-50/30 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-[0_8px_24px_rgba(249,115,22,0.12)]">
      <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-500 via-orange-400 to-amber-400" />
      <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-orange-500/5 blur-3xl" />
      <div className="relative flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-sm shadow-orange-500/30">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 17 9 11 13 15 21 7" /><polyline points="14 7 21 7 21 14" /></svg>
          </span>
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-slate-900">{t('priceActivity')}</p>
            <p className="mt-0.5 text-xs font-medium text-slate-500">{t('priceTrend')}</p>
          </div>
        </div>
        <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-bold text-slate-500">
          <span className="px-2 py-1">{t('timeRangeAll')}</span>
          <span className="rounded-md bg-orange-500 px-2 py-1 text-white">{t('timeRange1H')}</span>
          <span className="px-2 py-1">{t('timeRange6H')}</span>
          <span className="px-2 py-1">{t('timeRange1D')}</span>
        </div>
      </div>
      <div className="relative flex-1 min-h-[9rem] px-5 pb-4 pt-2">
          <div className="pointer-events-none absolute inset-x-5 top-2 bottom-12 rounded-xl bg-[linear-gradient(rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.04)_1px,transparent_1px)] bg-[size:60px_36px]" />
          <p className="absolute left-1 top-2 text-[9px] font-bold text-slate-400">AED</p>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="relative h-[calc(100%-1.5rem)] w-full overflow-visible">
            <path d={`${path} L 100 100 L 0 100 Z`} fill="rgba(249,115,22,0.18)" />
            <path d={path} fill="none" stroke="#F97316" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
            {reservePoint !== null && (
              <line x1="0" x2="100" y1={reservePoint} y2={reservePoint} stroke="#10b981" strokeWidth="0.6" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
            )}
            {series.slice(-12).map((point, index) => (
              <circle key={`${point.x}-${index}`} cx={point.x} cy={point.y} r="1.1" fill="#F97316" />
            ))}
          </svg>
        <div className="absolute inset-x-5 bottom-1 flex items-center gap-4 text-[9px] text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-3 bg-orange-500" />
            {t('currentBidLabel')}
          </span>
          {reservePoint !== null && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-3 border-t border-dashed border-emerald-500" />
              {t('reservePrice')}
            </span>
          )}
          <span className={`ms-auto text-[11px] font-black tabular-nums ${pulse ? 'text-orange-400' : 'text-orange-500'}`}>
            {fmt(currentBid || auction.startingBid, auction.currency, locale)}
          </span>
        </div>
      </div>
    </div>
  );

  const history = (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-emerald-50/30 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_8px_24px_rgba(16,185,129,0.12)]">
      <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400" />
      <span aria-hidden className="pointer-events-none absolute -left-16 -top-16 h-40 w-40 rounded-full bg-emerald-500/5 blur-3xl" />
        <div className="relative flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm shadow-emerald-500/30">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></svg>
            </span>
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-slate-900">{t('history')}</p>
              <p className="mt-0.5 text-xs font-medium text-slate-500">{tb('subtitle')}</p>
            </div>
          </div>
          {auction.status === 'LIVE' && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-600 ring-1 ring-emerald-200">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> {tb('live')}
            </span>
          )}
        </div>
        <div className="relative flex-1 px-5 pt-2.5">
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-2 pb-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
            <span>{tb('bidder')}</span>
            <span className="text-end">{tb('amount')}</span>
            <span className="text-end">{tb('time')}</span>
          </div>
          <ul className="max-h-[140px] divide-y divide-slate-100 overflow-y-auto pr-1">
            {bids.length === 0 && (
              <li className="px-2 py-6 text-center text-xs text-slate-400">{tb('noBids')}</li>
            )}
            {bids.slice(0, 3).map((bid, index) => (
              <li key={bid.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-2 py-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${avatarColors[index % avatarColors.length]} text-xs font-black text-white shadow`}>
                    {bid.bidderInitial}
                  </span>
                  {index === 0 && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-orange-50 px-2 py-0.5 text-xs font-bold text-orange-500">★ {tb('leading')}</span>
                  )}
                </div>
                <span className={`text-end text-base font-black tabular-nums ${index === 0 ? 'text-orange-500' : 'text-slate-700'}`}>{fmt(bid.amount, bid.currency, locale)}</span>
                <span className="text-end text-xs text-slate-400">{relativeTime(bid.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      <div className="relative border-t border-slate-100 px-3 py-2.5">
        <Link
          href={`/${locale}/auctions/${auction.slug}/bids`}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-50 to-amber-50 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-orange-600 ring-1 ring-orange-200 transition hover:from-orange-500 hover:to-amber-500 hover:text-white hover:shadow-[0_4px_12px_rgba(249,115,22,0.3)]"
        >
          <span>{tb('viewAll', { count: totalBids })}</span>
          <span aria-hidden className="transition-transform hover:translate-x-1">→</span>
        </Link>
      </div>
    </div>
  );

  if (mode === 'chart') return <section className={`h-full ${className ?? ''}`}>{chart}</section>;
  if (mode === 'history') return <section className={`h-full ${className ?? ''}`}>{history}</section>;
  return (
    <section className={`grid gap-4 lg:grid-cols-2 ${className ?? ''}`}>
      {chart}
      {history}
    </section>
  );
}
