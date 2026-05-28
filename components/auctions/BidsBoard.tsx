'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import type { AuctionBidEvent } from '@/lib/auctions/emitter';
import type { AuctionDetailDTO, AuctionBidEntry } from '@/lib/auctions/service';
import { useAuctionRealtime } from '@/lib/auctions/useAuctionRealtime';

type Props = {
  auction: AuctionDetailDTO;
  initialBids: AuctionBidEntry[];
  locale: string;
  loggedIn: boolean;
  loginHref: string;
};

type Range = '1H' | '6H' | '1D' | 'ALL';

function fmt(amount: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function fmtPlain(amount: number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(amount);
}

const RANGE_MS: Record<Range, number | null> = {
  '1H': 60 * 60 * 1000,
  '6H': 6 * 60 * 60 * 1000,
  '1D': 24 * 60 * 60 * 1000,
  ALL: null,
};

export function BidsBoard({ auction, initialBids, locale, loggedIn, loginHref }: Props) {
  const t = useTranslations('auctions.bidsPage');

  const [bids, setBids] = useState<AuctionBidEntry[]>(initialBids);
  const [currentBid, setCurrentBid] = useState(auction.currentBid);
  const [totalBids, setTotalBids] = useState(auction.bidCount);
  const [range, setRange] = useState<Range>('ALL');
  const [pulse, setPulse] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // ticking clock for "x seconds ago" labels
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const handleBid = useCallback(
    (ev: AuctionBidEvent) => {
      setCurrentBid(ev.currentBid);
      setTotalBids(ev.totalBids);
      setBids((prev) => [
        {
          id: `live-${Date.now()}`,
          amount: ev.currentBid,
          currency: auction.currency,
          createdAt: new Date().toISOString(),
          bidderInitial: ev.bidderInitial,
          bidderName: `${ev.bidderInitial}***`,
        },
        ...prev,
      ]);
      setPulse(true);
      window.setTimeout(() => setPulse(false), 900);
    },
    [auction.currency],
  );

  const handlers = useMemo(() => ({ onBid: handleBid }), [handleBid]);
  useAuctionRealtime(auction.id, auction.status === 'LIVE', handlers);

  // Filtered series for chart
  const series = useMemo(() => {
    const cutoff = RANGE_MS[range];
    const sorted = [...bids].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const filtered = cutoff
      ? sorted.filter((b) => Date.now() - new Date(b.createdAt).getTime() <= cutoff)
      : sorted;
    return filtered.length > 0 ? filtered : sorted;
  }, [bids, range]);

  const chart = useMemo(() => {
    const points = series.length > 0
      ? series.map((b) => b.amount)
      : [auction.startingBid, currentBid || auction.startingBid];
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = Math.max(1, max - min);

    const coords = points.map((value, index) => ({
      x: points.length === 1 ? 50 : (index / (points.length - 1)) * 100,
      y: 92 - ((value - min) / range) * 78,
      value,
    }));
    const path = coords
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(' ');
    const reservePoint = auction.reservePrice
      ? 92 - ((auction.reservePrice - min) / range) * 78
      : null;
    return { coords, path, min, max, reservePoint };
  }, [series, auction.startingBid, auction.reservePrice, currentBid]);

  // Stats
  const stats = useMemo(() => {
    if (bids.length === 0) {
      return {
        highest: auction.startingBid,
        lowest: auction.startingBid,
        average: auction.startingBid,
        unique: 0,
        change24h: 0,
      };
    }
    const amounts = bids.map((b) => b.amount);
    const highest = Math.max(...amounts);
    const lowest = Math.min(...amounts);
    const average = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
    const unique = new Set(bids.map((b) => b.bidderName)).size;

    // 24h delta vs first bid in window
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const inWindow = bids.filter((b) => new Date(b.createdAt).getTime() >= cutoff);
    const firstInWindow = inWindow[inWindow.length - 1];
    const lastInWindow = inWindow[0];
    const change24h = firstInWindow && lastInWindow
      ? ((lastInWindow.amount - firstInWindow.amount) / Math.max(1, firstInWindow.amount)) * 100
      : 0;
    return { highest, lowest, average, unique, change24h };
  }, [bids, auction.startingBid]);

  // Order book buckets by amount band
  const orderBook = useMemo(() => {
    const sortedDesc = [...bids].sort((a, b) => b.amount - a.amount);
    const max = stats.highest;
    return sortedDesc.slice(0, 12).map((bid) => ({
      ...bid,
      pct: max > 0 ? (bid.amount / max) * 100 : 0,
    }));
  }, [bids, stats.highest]);

  const relativeTime = useCallback(
    (iso: string) => {
      const diff = Math.max(0, now - new Date(iso).getTime());
      const sec = Math.floor(diff / 1000);
      if (sec < 60) return t('justNow');
      const min = Math.floor(sec / 60);
      if (min < 60) return t('minutesAgo', { minutes: min });
      const hr = Math.floor(min / 60);
      if (hr < 24) return t('hoursAgo', { hours: hr });
      const days = Math.floor(hr / 24);
      return t('daysAgo', { days });
    },
    [now, t],
  );

  const avatarColors = [
    'from-orange-400 to-orange-600',
    'from-emerald-400 to-emerald-600',
    'from-sky-400 to-sky-600',
    'from-rose-400 to-rose-600',
    'from-violet-400 to-violet-600',
    'from-amber-400 to-amber-600',
    'from-cyan-400 to-cyan-600',
    'from-fuchsia-400 to-fuchsia-600',
  ];

  const ranges: Range[] = ['1H', '6H', '1D', 'ALL'];
  const isLive = auction.status === 'LIVE';

  return (
    <div className="min-h-screen bg-[#0B1220] text-[15px] leading-6 text-white sm:text-base">
      {/* Top Ticker */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#0B1220]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-4 py-3 sm:px-6">
          <Link
            href={`/${locale}/auctions/${auction.slug}`}
            className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white/55 transition hover:text-white"
          >
            <span aria-hidden className="rtl:rotate-180">←</span>
            {t('backToAuction')}
          </Link>
          <span className="hidden text-white/20 sm:inline">/</span>
          <h1 className="hidden truncate text-base font-black text-white sm:block lg:text-lg">{auction.title}</h1>
          <div className="ms-auto flex items-center gap-3">
            {isLive && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                {t('live')}
              </span>
            )}
            <Link
              href={`/${locale}/auctions/${auction.slug}#bid-form`}
              className="rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white shadow-[0_0_24px_rgba(249,115,22,0.4)] transition hover:from-orange-400 hover:to-orange-500"
            >
              {t('placeBid')}
            </Link>
          </div>
        </div>

        {/* Price ticker row */}
        <div className="border-t border-white/5 bg-[#07111f]">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <span className={`text-3xl font-black tabular-nums sm:text-[2.15rem] ${pulse ? 'text-orange-300' : 'text-orange-400'}`}>
                {fmt(currentBid || auction.startingBid, auction.currency, locale)}
              </span>
              <span className={`rounded-md px-2 py-0.5 text-[10px] font-black ${stats.change24h >= 0 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>
                {stats.change24h >= 0 ? '+' : ''}
                {stats.change24h.toFixed(2)}%
              </span>
            </div>

            <Stat label={t('highest')} value={fmt(stats.highest, auction.currency, locale)} accent="text-emerald-300" />
            <Stat label={t('lowest')} value={fmt(stats.lowest, auction.currency, locale)} accent="text-sky-300" />
            <Stat label={t('average')} value={fmt(stats.average, auction.currency, locale)} accent="text-amber-300" />
            <Stat label={t('totalBids')} value={fmtPlain(totalBids, locale)} accent="text-white" />
            <Stat label={t('uniqueBidders')} value={fmtPlain(stats.unique, locale)} accent="text-violet-300" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
          {/* Chart + table column */}
          <div className="space-y-4">
            <section className="overflow-hidden rounded-2xl border border-white/5 bg-[#07111f] shadow-[0_18px_45px_rgba(2,6,23,0.4)]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-white/85">
                    {t('chartTitle')}
                  </p>
                  <p className="mt-0.5 text-xs text-white/40">{t('chartSubtitle')}</p>
                </div>
                <div className="flex rounded-lg bg-white/5 p-0.5 text-[11px] font-bold">
                  {ranges.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRange(r)}
                      className={`rounded-md px-3 py-1.5 transition ${
                        range === r ? 'bg-orange-500 text-white' : 'text-white/55 hover:text-white'
                      }`}
                    >
                      {r === 'ALL' ? t('rangeAll') : r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative h-[360px] px-5 pb-6 pt-3 lg:h-[420px]">
                <div className="pointer-events-none absolute inset-x-5 top-3 bottom-12 rounded-xl bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:80px_44px]" />

                {/* Y axis labels */}
                <div className="pointer-events-none absolute left-1 top-3 bottom-12 flex flex-col justify-between text-[10px] font-bold text-white/35">
                  <span>{fmt(chart.max, auction.currency, locale)}</span>
                  <span>{fmt((chart.max + chart.min) / 2, auction.currency, locale)}</span>
                  <span>{fmt(chart.min, auction.currency, locale)}</span>
                </div>

                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="relative h-[calc(100%-2rem)] w-full overflow-visible"
                >
                  <defs>
                    <linearGradient id="bidsArea" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#F97316" stopOpacity="0.45" />
                      <stop offset="100%" stopColor="#F97316" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={`${chart.path} L 100 100 L 0 100 Z`} fill="url(#bidsArea)" />
                  <path
                    d={chart.path}
                    fill="none"
                    stroke="#F97316"
                    strokeWidth="1.6"
                    vectorEffect="non-scaling-stroke"
                  />
                  {chart.reservePoint !== null && (
                    <line
                      x1="0"
                      x2="100"
                      y1={chart.reservePoint}
                      y2={chart.reservePoint}
                      stroke="#10b981"
                      strokeWidth="0.6"
                      strokeDasharray="2 2"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                  {chart.coords.slice(-30).map((p, i) => (
                    <circle key={`${p.x}-${i}`} cx={p.x} cy={p.y} r="0.9" fill="#F97316" />
                  ))}
                </svg>

                <div className="absolute inset-x-5 bottom-2 flex items-center gap-4 text-[11px] text-white/40">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-0.5 w-3 bg-orange-500" /> {t('legendCurrent')}
                  </span>
                  {chart.reservePoint !== null && (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-0.5 w-3 border-t border-dashed border-emerald-400" />
                      {t('legendReserve')}
                    </span>
                  )}
                  <span className="ms-auto text-[10px] font-black uppercase tracking-wider text-white/55">
                    {bids.length} {t('dataPoints')}
                  </span>
                </div>
              </div>
            </section>

            {/* Full bids table */}
            <section className="overflow-hidden rounded-2xl border border-white/5 bg-[#07111f] shadow-[0_18px_45px_rgba(2,6,23,0.4)]">
              <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/85">{t('allBids')}</p>
                  <p className="mt-0.5 text-[11px] text-white/40">{t('allBidsSubtitle')}</p>
                </div>
                <span className="rounded-full bg-white/5 px-3 py-1 text-[10px] font-black text-white/70">
                  {totalBids}
                </span>
              </div>

              {bids.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <p className="text-base font-black text-white/85">{t('noBids')}</p>
                  <p className="mt-1 text-xs text-white/40">{t('noBidsHint')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[15px]">
                    <thead>
                      <tr className="border-b border-white/5 text-[10px] font-black uppercase tracking-[0.22em] text-white/35">
                        <th className="px-5 py-3 text-start">{t('rank')}</th>
                        <th className="px-2 py-3 text-start">{t('bidder')}</th>
                        <th className="px-2 py-3 text-end">{t('amount')}</th>
                        <th className="hidden px-2 py-3 text-end sm:table-cell">{t('vsCurrent')}</th>
                        <th className="px-5 py-3 text-end">{t('time')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bids.map((bid, index) => {
                        const delta = currentBid > 0 ? ((bid.amount - currentBid) / currentBid) * 100 : 0;
                        const isLeader = index === 0;
                        return (
                          <tr
                            key={bid.id}
                            className={`border-b border-white/5 transition hover:bg-white/[0.03] ${
                              isLeader ? 'bg-gradient-to-r from-orange-500/10 via-transparent to-transparent' : ''
                            }`}
                          >
                            <td className="px-5 py-3 text-xs font-black tabular-nums text-white/55">
                              #{index + 1}
                            </td>
                            <td className="px-2 py-3">
                              <div className="flex min-w-0 items-center gap-2.5">
                                <span
                                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${avatarColors[index % avatarColors.length]} text-[11px] font-black text-white shadow`}
                                >
                                  {bid.bidderInitial}
                                </span>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold text-white/85">{bid.bidderName}</p>
                                  {isLeader && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-300">
                                      ★ {t('leading')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td
                              className={`px-2 py-3 text-end text-[15px] font-black tabular-nums ${
                                isLeader ? 'text-orange-400' : 'text-white/85'
                              }`}
                            >
                              {fmt(bid.amount, bid.currency, locale)}
                            </td>
                            <td className="hidden px-2 py-3 text-end tabular-nums sm:table-cell">
                              <span
                                className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-black ${
                                  delta >= 0 ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'
                                }`}
                              >
                                {delta >= 0 ? '+' : ''}
                                {delta.toFixed(2)}%
                              </span>
                            </td>
                            <td className="px-5 py-3 text-end text-xs text-white/40">
                              {relativeTime(bid.createdAt)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          {/* Right rail */}
          <aside className="space-y-4">
            <section className="rounded-2xl border border-white/5 bg-[#07111f] p-5 shadow-[0_18px_45px_rgba(2,6,23,0.4)]">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-white/85">{t('orderBook')}</p>
              <p className="mt-0.5 text-xs text-white/40">{t('orderBookSubtitle')}</p>

              <div className="mt-4 space-y-1.5">
                {orderBook.length === 0 && (
                  <p className="rounded-xl bg-white/5 px-3 py-6 text-center text-[11px] text-white/45">
                    {t('noBids')}
                  </p>
                )}
                {orderBook.map((bid, index) => (
                  <div key={bid.id} className="relative overflow-hidden rounded-md">
                    <div
                      className="absolute inset-y-0 end-0 bg-gradient-to-l from-orange-500/20 to-orange-500/0"
                      style={{ width: `${bid.pct}%` }}
                      aria-hidden
                    />
                    <div className="relative grid grid-cols-[auto_1fr_auto] items-center gap-3 px-2 py-1.5 text-sm">
                      <span className="font-black tabular-nums text-white/45">#{index + 1}</span>
                      <span className="truncate font-bold text-white/85">{bid.bidderName}</span>
                      <span className={`font-black tabular-nums ${index === 0 ? 'text-orange-400' : 'text-white/85'}`}>
                        {fmt(bid.amount, bid.currency, locale)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-white/5 bg-gradient-to-br from-orange-500/15 via-transparent to-transparent p-5 ring-1 ring-orange-500/20">
              <p className="text-sm font-black uppercase tracking-[0.22em] text-orange-300">{t('cta.title')}</p>
              <p className="mt-2 text-lg text-white/85">{t('cta.body')}</p>
              {loggedIn ? (
                <Link
                  href={`/${locale}/auctions/${auction.slug}#bid-form`}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-3 text-sm font-black uppercase tracking-wider text-white shadow-[0_0_24px_rgba(249,115,22,0.4)] transition hover:from-orange-400 hover:to-orange-500"
                >
                  {t('placeBid')}
                </Link>
              ) : (
                <Link
                  href={loginHref}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-3 text-sm font-black uppercase tracking-wider text-white shadow-[0_0_24px_rgba(249,115,22,0.4)] transition hover:from-orange-400 hover:to-orange-500"
                >
                  {t('cta.signIn')}
                </Link>
              )}
            </section>

            <section className="rounded-2xl border border-white/5 bg-[#07111f] p-5">
              <p className="text-sm font-black uppercase tracking-[0.22em] text-white/85">{t('marketInfo')}</p>
              <dl className="mt-3 space-y-2 text-sm">
                <Row label={t('startingBid')} value={fmt(auction.startingBid, auction.currency, locale)} />
                {auction.reservePrice && (
                  <Row label={t('reservePrice')} value={fmt(auction.reservePrice, auction.currency, locale)} />
                )}
                <Row label={t('minIncrement')} value={fmt(auction.minIncrement, auction.currency, locale)} />
                <Row label={t('currency')} value={auction.currency} />
                <Row label={t('endsAt')} value={new Date(auction.endsAt).toLocaleString(locale)} />
              </dl>
            </section>
          </aside>
        </div>

        <p className="mt-6 text-center text-[10px] text-white/35">{t('disclaimer')}</p>
      </main>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  if (!label) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40">{label}</span>
      <span className={`text-[13px] font-black tabular-nums ${accent}`}>{value}</span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-white/45">{label}</dt>
      <dd className="font-black tabular-nums text-white/85">{value}</dd>
    </div>
  );
}
