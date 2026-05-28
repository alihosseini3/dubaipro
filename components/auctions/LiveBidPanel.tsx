'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';

import type { AuctionBidEvent, AuctionWatchEvent } from '@/lib/auctions/emitter';
import type { AuctionDetailDTO } from '@/lib/auctions/service';
import { useAuctionRealtime } from '@/lib/auctions/useAuctionRealtime';

import { CountdownTimer } from './CountdownTimer';
import { WatchButton }   from './WatchButton';

/* ─── Types ─────────────────────────────────────────────────────────────── */

type BidEntry = {
  id:             string;
  amount:         number;
  currency:       string;
  createdAt:      string;
  bidderInitial:  string;
};

type MyBid = {
  id:        string;
  amount:    number;
  currency:  string;
  createdAt: string;
};

type Props = {
  auction:         AuctionDetailDTO;
  loggedIn:        boolean;
  initialWatching: boolean;
  locale:          string;
  loginHref:       string;
  supplierHref?:   string;
};

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function fmt(amount: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(amount);
}

const AVATAR_GRADIENTS = [
  'from-orange-500 to-rose-500',
  'from-amber-500 to-orange-600',
  'from-fuchsia-500 to-purple-600',
  'from-emerald-500 to-teal-600',
  'from-sky-500 to-indigo-600',
  'from-rose-500 to-pink-600',
] as const;

function gradientFor(initial: string): string {
  const code = initial.charCodeAt(0) || 0;
  return AVATAR_GRADIENTS[code % AVATAR_GRADIENTS.length];
}

/** Color the urgency bar from green → amber → red as the auction nears its end. */
function urgencyColor(msLeft: number): string {
  if (msLeft < 5 * 60_000)        return 'from-rose-500 to-red-600';
  if (msLeft < 30 * 60_000)       return 'from-amber-400 to-orange-500';
  return 'from-emerald-400 to-emerald-600';
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export function LiveBidPanel({
  auction: initial,
  loggedIn,
  initialWatching,
  locale,
  loginHref,
  supplierHref,
}: Props) {
  const t = useTranslations('auctions.detail');

  const [mounted,    setMounted]    = useState(false);
  const [currentBid,   setCurrentBid]   = useState(initial.currentBid);
  const [totalBids,    setTotalBids]    = useState(initial.bidCount);
  const [endsAt,       setEndsAt]       = useState(initial.endsAt);
  const [reserveMet,   setReserveMet]   = useState(initial.reserveMet);
  const [watcherCount, setWatcherCount] = useState(initial.watcherCount);
  const [bids,         setBids]         = useState<BidEntry[]>(initial.recentBids);
  const [bidAmount,    setBidAmount]    = useState(
    initial.currentBid > 0 ? initial.currentBid + initial.minIncrement : initial.startingBid
  );
  const [error,      setError]    = useState<string | null>(null);
  const [flash,      setFlash]    = useState(false);
  const [extended,   setExt]      = useState(false);
  const [success,    setSuccess]  = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [burst,      setBurst]    = useState(false);
  const [isPending,  start]       = useTransition();
  const [msLeft,   setMsLeft]  = useState<number | null>(null);
  const [lastBidTs, setLastBidTs] = useState<number | null>(
    initial.recentBids[0] ? new Date(initial.recentBids[0].createdAt).getTime() : null
  );
  const [, setNowTick] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  /* ── User's own bids on this auction ── */
  const [myBids, setMyBids] = useState<MyBid[]>([]);
  const [editingBidId, setEditingBidId] = useState<string | null>(null);
  const myLatestBid = myBids.length > 0
    ? myBids.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
    : null;

  const refreshMyBids = useCallback(() => {
    if (!loggedIn) return;
    fetch(`/api/auctions/${initial.id}/bids`)
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((json: { data?: MyBid[] }) => setMyBids(json.data ?? []))
      .catch(() => undefined);
  }, [initial.id, loggedIn]);

  const baseLive = initial.status === 'LIVE';
  const isLive  = baseLive && msLeft !== null && msLeft > 0;
  const minNext = currentBid > 0
    ? currentBid + initial.minIncrement
    : initial.startingBid;
  const totalDuration = new Date(initial.endsAt).getTime() - new Date(initial.startsAt).getTime();
  const progress = msLeft === null ? 0 : Math.max(0, Math.min(1, msLeft / Math.max(1, totalDuration)));

  useEffect(() => {
    setMounted(true);
  }, []);

  /* ── tick countdown for urgency bar ── */
  useEffect(() => {
    if (!baseLive) {
      setMsLeft(null);
      return;
    }

    const tick = () => {
      setMsLeft(new Date(endsAt).getTime() - Date.now());
    };

    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [endsAt, baseLive]);

  /* ── tick once every 10s for relative-time labels ── */
  useEffect(() => {
    const id = setInterval(() => setNowTick((n) => n + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  const handleRealtimeBid = useCallback((ev: AuctionBidEvent) => {
      const prevEndsAt = endsAt;
      setCurrentBid(ev.currentBid);
      setTotalBids(ev.totalBids);
      setEndsAt(ev.endsAt);
      setReserveMet(ev.reserveMet);
      const now = Date.now();
      setLastBidTs(now);
      setBids((prev) => [
        {
          id:             `live-${now}`,
          amount:         ev.currentBid,
          currency:       initial.currency,
          createdAt:      new Date(now).toISOString(),
          bidderInitial:  ev.bidderInitial,
        },
        ...prev.slice(0, 24),
      ]);
      /* Pulse + extension banner */
      setFlash(true);
      setTimeout(() => setFlash(false), 800);
      if (ev.endsAt !== prevEndsAt) {
        setExt(true);
        setTimeout(() => setExt(false), 4000);
      }
      listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [endsAt, initial.currency]);

  const handleRealtimeWatch = useCallback((ev: AuctionWatchEvent) => {
    setWatcherCount(ev.watcherCount);
  }, []);

  const realtimeHandlers = useMemo(() => ({
    onBid: handleRealtimeBid,
    onWatch: handleRealtimeWatch,
  }), [handleRealtimeBid, handleRealtimeWatch]);

  useAuctionRealtime(initial.id, isLive, realtimeHandlers);

  /* keep input ≥ minNext */
  useEffect(() => { setBidAmount((prev) => Math.max(prev, minNext)); }, [minNext]);

  /* fetch user's own bids on mount */
  useEffect(() => { refreshMyBids(); }, [refreshMyBids]);

  /* ── submit (place new bid OR update existing) ── */
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!loggedIn) { window.location.href = loginHref; return; }
    setError(null);
    setSuccess(false);
    if (!Number.isFinite(bidAmount) || bidAmount < minNext) {
      setError(t('errors.too_low'));
      return;
    }
    const isEditing = editingBidId !== null;
    start(async () => {
      const res = await fetch(`/api/auctions/${initial.id}/bid`, {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEditing ? { bidId: editingBidId, amount: bidAmount } : { amount: bidAmount }),
      }).catch(() => null);
      if (!res) { setError(t('errors.generic')); return; }
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as { error?: string };
        const key = j.error ?? 'generic';
        const validKeys = ['too_low','ended','not_live','not_found','self_bid','unauthorized','generic'];
        setError(t(`errors.${validKeys.includes(key) ? key : 'generic'}` as `errors.${string}`));
        return;
      }
      setSuccess(true);
      setBurst(true);
      setEditingBidId(null);
      refreshMyBids();
      setTimeout(() => setSuccess(false), 3000);
      setTimeout(() => setBurst(false), 1200);
    });
  }

  /* ── delete user's latest bid ── */
  async function deleteMyBid() {
    if (!myLatestBid) return;
    if (!window.confirm(t('myBidConfirmDelete'))) return;
    setError(null);
    setSuccess(false);
    start(async () => {
      const res = await fetch(`/api/auctions/${initial.id}/bid`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bidId: myLatestBid.id }),
      }).catch(() => null);
      if (!res || !res.ok) {
        const j = res ? (await res.json().catch(() => ({}))) as { error?: string } : { error: 'generic' };
        const key = j.error ?? 'generic';
        const validKeys = ['too_low','ended','not_live','not_found','self_bid','unauthorized','generic'];
        setError(t(`errors.${validKeys.includes(key) ? key : 'generic'}` as `errors.${string}`));
        return;
      }
      setEditingBidId((cur) => (cur === myLatestBid.id ? null : cur));
      refreshMyBids();
    });
  }

  function startEditMyBid() {
    if (!myLatestBid) return;
    setError(null);
    setSuccess(false);
    setEditingBidId(myLatestBid.id);
    setBidAmount(Math.max(myLatestBid.amount, minNext));
  }

  function cancelEditMyBid() {
    setEditingBidId(null);
    setBidAmount(minNext);
  }

  /** Localised "X seconds ago" relative time. */
  function relativeTime(ts: number | null): string | null {
    if (!mounted || ts === null) return null;
    const diff = Math.max(0, Date.now() - ts);
    const sec = Math.floor(diff / 1000);
    if (sec < 10)  return t('justNow');
    if (sec < 60)  return t('secondsAgo', { seconds: sec });
    const min = Math.floor(sec / 60);
    if (min < 60)  return t('minutesAgo', { minutes: min });
    const hr = Math.floor(min / 60);
    return t('hoursAgo', { hours: hr });
  }

  /** Reserve progress 0-1 (only when reservePrice is set and >0). */
  const reserveProgress =
    initial.reservePrice && initial.reservePrice > 0
      ? Math.max(0, Math.min(1, currentBid / initial.reservePrice))
      : null;

  const urgent = msLeft !== null && msLeft < 5 * 60_000 && isLive;

  function share() {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: initial.title, url }).catch(() => null);
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2500);
      });
    }
  }

  return (
    <div className="space-y-3">

      {/* ── Supplier card ── */}
      {initial.supplierName && (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradientFor(initial.supplierName[0] ?? 'S')} text-sm font-black text-white shadow`}>
            {(initial.supplierName[0] ?? '?').toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-[#0F172A]">{initial.supplierName}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              {initial.supplierVerified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  <svg viewBox="0 0 20 20" className="h-2.5 w-2.5" fill="currentColor" aria-hidden><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" /></svg>
                  {t('trust.verified')}
                </span>
              )}
              {initial.supplierCountry && (
                <span className="text-[11px] text-slate-400">{initial.supplierCountry}</span>
              )}
            </div>
          </div>
          {supplierHref && (
            <a href={supplierHref} className="shrink-0 rounded-lg bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-orange-50 hover:text-[#F97316]">
              {t('viewStore')} →
            </a>
          )}
        </div>
      )}

      {/* ── Bid stats card ── */}
      <div className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-500 ${
        flash    ? 'ring-2 ring-[#F97316] shadow-[0_0_28px_rgba(249,115,22,0.35)]' :
        urgent   ? 'ring-2 ring-rose-400 shadow-[0_0_28px_rgba(244,63,94,0.35)] animate-[pulse_2s_ease-in-out_infinite]' :
                   'ring-1 ring-slate-200/70'
      }`}>
        {/* Top gradient accent bar */}
        <div className={`h-1 w-full bg-gradient-to-r ${
          urgent ? 'from-rose-500 via-red-500 to-rose-500 animate-[gradient_2s_ease-in-out_infinite] bg-[length:200%_100%]' :
          isLive ? 'from-emerald-400 to-orange-400' :
                   'from-slate-300 to-slate-400'
        }`} />

        {/* Extension banner */}
        {extended && (
          <div className="bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400 px-4 py-1.5 text-center text-[11px] font-bold text-white">
            ⚡ {t('extended')}
          </div>
        )}

        {/* Urgent banner when <10min */}
        {isLive && msLeft < 10 * 60_000 && msLeft > 0 && !urgent && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-[11px] font-bold text-amber-800">
            ⏰ {t('urgentTime')}
          </div>
        )}

        <div className="p-5">
          {/* Price row */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                {currentBid > 0 ? t('currentBid') : t('startingBid')}
              </p>
              <p className={`mt-1 text-3xl font-black leading-none tabular-nums tracking-tight transition-all sm:text-4xl ${
                flash ? 'scale-105 text-[#F97316]' : urgent ? 'text-rose-600' : 'text-[#0F172A]'
              }`}>
                {fmt(currentBid > 0 ? currentBid : initial.startingBid, initial.currency, locale)}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                <span className="font-semibold">{t('bidsCount', { count: totalBids })}</span>
                <span className="h-1 w-1 rounded-full bg-slate-300" />
                <span>{t('watchersCount', { count: watcherCount })}</span>
                {lastBidTs && (
                  <>
                    <span className="h-1 w-1 rounded-full bg-slate-300" />
                    <span className="inline-flex items-center gap-1">
                      <span className="relative inline-flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-60" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-orange-500" />
                      </span>
                      {relativeTime(lastBidTs)}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="shrink-0 text-end">
              <p className="mb-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                {t('reservePrice')}
              </p>
              <p className="text-sm font-black text-[#0F172A]">
                {initial.reservePrice ? fmt(initial.reservePrice, initial.currency, locale) : t('reserve.noReserve')}
              </p>
            </div>
          </div>

          {isLive && (
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{t('bidders')}</p>
                <p className="mt-0.5 text-lg font-black text-[#0F172A]">{new Set(bids.map((b) => b.bidderInitial)).size}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{t('watchers')}</p>
                <p className="mt-0.5 text-lg font-black text-[#0F172A]">{watcherCount}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{t('bidActivity')}</p>
                <p className="mt-0.5 text-lg font-black text-emerald-600">{watcherCount >= 10 ? t('activityHigh') : t('activityLive')}</p>
              </div>
            </div>
          )}

          {/* Time-progress bar */}
          {isLive && (
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full bg-gradient-to-r ${urgencyColor(msLeft)} transition-all duration-1000`}
                style={{ width: `${Math.max(2, progress * 100)}%` }}
              />
            </div>
          )}

          {/* Reserve progress bar (only when reserve exists & not yet met) */}
          {reserveProgress !== null && !reserveMet && (
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                <span className="text-amber-700">{t('reserveProgress')}</span>
                <span className="text-slate-500 tabular-nums">{Math.round(reserveProgress * 100)}%</span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-amber-50 ring-1 ring-amber-100">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-700"
                  style={{ width: `${Math.max(3, reserveProgress * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Reserve + min bid row */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {initial.reservePrice !== null ? (
              <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                reserveMet ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${reserveMet ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                {reserveMet ? t('reserve.met') : t('reserve.notMet')}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                {t('reserve.noReserve')}
              </span>
            )}
            {isLive && (
              <span className="text-[11px] text-slate-500">
                {t('minNextBid')}: <strong className="text-[#0F172A]">{fmt(minNext, initial.currency, locale)}</strong>
              </span>
            )}
          </div>

          {/* Success burst — sparkles fly out when own bid succeeds */}
          {burst && (
            <div aria-hidden className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
              {[0, 60, 120, 180, 240, 300].map((angle) => (
                <span
                  key={angle}
                  className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-[#F97316]"
                  style={{
                    animation: 'bid-burst 900ms ease-out forwards',
                    boxShadow: '0 0 12px rgba(249,115,22,0.8)',
                    ['--a' as string]: `${angle}deg`,
                  } as React.CSSProperties}
                />
              ))}
              <style>{`
                @keyframes bid-burst {
                  0%   { opacity: 1; transform: rotate(var(--a, 0deg)) translateX(0) scale(1); }
                  100% { opacity: 0; transform: rotate(var(--a, 0deg)) translateX(140px) scale(0.3); }
                }
              `}</style>
            </div>
          )}

          {/* ── Bid form ── */}
          {isLive ? (
            loggedIn ? (
              <form onSubmit={submit} className="mt-4 space-y-3">
                {/* Quick increment chips */}
                <div className="flex flex-wrap gap-1.5">
                  <p className="w-full text-[10px] font-bold uppercase tracking-widest text-slate-400">{t('quickBid')}</p>
                  {[initial.minIncrement, initial.minIncrement * 2, initial.minIncrement * 5, initial.minIncrement * 10].map((inc) => (
                    <button
                      key={inc}
                      type="button"
                      onClick={() => setBidAmount(minNext + inc)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-300 hover:bg-orange-50 hover:text-[#F97316] hover:shadow-md"
                    >
                      +{fmt(inc, initial.currency, locale)}
                    </button>
                  ))}
                </div>
                {/* Input + submit */}
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(Number(e.target.value) || 0)}
                    min={minNext}
                    step="any"
                    aria-label={t('yourBid', { currency: initial.currency })}
                    className="block flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-base font-bold tabular-nums text-[#0F172A] outline-none focus:border-[#F97316] focus:bg-white focus:ring-2 focus:ring-orange-100"
                  />
                  <button
                    type="submit"
                    disabled={isPending}
                    className="flex-shrink-0 rounded-xl bg-[#F97316] px-5 py-3 text-sm font-black text-white shadow-[0_8px_18px_rgba(249,115,22,0.28)] transition hover:bg-orange-600 disabled:opacity-60"
                  >
                    {isPending ? '…' : (editingBidId ? t('myBidUpdateLabel') : t('placeBid'))}
                  </button>
                </div>

                {/* Manage own bid: Edit / Delete */}
                {myLatestBid && (
                  editingBidId ? (
                    <div className="flex items-center gap-2 rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 p-2 shadow-[0_2px_8px_rgba(249,115,22,0.08)]">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-sm shadow-orange-500/30">
                        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M13.586 3.586a2 2 0 1 1 2.828 2.828l-9 9a1 1 0 0 1-.39.242l-3.5 1.167a.5.5 0 0 1-.633-.633l1.167-3.5a1 1 0 0 1 .242-.39l9-9z" /></svg>
                      </span>
                      <span className="flex-1 truncate text-[11px] font-bold text-orange-800">
                        {t('myBidEditingHint', { amount: fmt(myLatestBid.amount, myLatestBid.currency, locale) })}
                      </span>
                      <button
                        type="button"
                        onClick={cancelEditMyBid}
                        disabled={isPending}
                        className="group inline-flex shrink-0 items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-black text-slate-600 ring-1 ring-slate-200 transition-all hover:-translate-y-0.5 hover:bg-slate-50 hover:text-slate-900 hover:shadow-md disabled:opacity-60"
                      >
                        <svg viewBox="0 0 20 20" className="h-3 w-3 transition-transform group-hover:rotate-90" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M6 6l8 8M14 6l-8 8" /></svg>
                        {t('myBidCancelEdit')}
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={startEditMyBid}
                        disabled={isPending}
                        className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-white via-white to-orange-50/50 px-4 py-2.5 text-xs font-black text-slate-700 shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-300 hover:from-orange-50 hover:to-amber-50 hover:text-[#F97316] hover:shadow-[0_8px_20px_rgba(249,115,22,0.15)] active:translate-y-0 disabled:opacity-60"
                      >
                        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-300/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-[#F97316] transition-all group-hover:bg-gradient-to-br group-hover:from-orange-500 group-hover:to-amber-500 group-hover:text-white group-hover:shadow-sm">
                          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M13.586 3.586a2 2 0 1 1 2.828 2.828l-9 9a1 1 0 0 1-.39.242l-3.5 1.167a.5.5 0 0 1-.633-.633l1.167-3.5a1 1 0 0 1 .242-.39l9-9z" /></svg>
                        </span>
                        <span className="uppercase tracking-wider">{t('myBidEditLabel')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteMyBid()}
                        disabled={isPending}
                        className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-white via-white to-rose-50/50 px-4 py-2.5 text-xs font-black text-slate-700 shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-rose-300 hover:from-rose-50 hover:to-pink-50 hover:text-rose-600 hover:shadow-[0_8px_20px_rgba(244,63,94,0.15)] active:translate-y-0 disabled:opacity-60"
                      >
                        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-300/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600 transition-all group-hover:bg-gradient-to-br group-hover:from-rose-500 group-hover:to-pink-500 group-hover:text-white group-hover:shadow-sm">
                          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h12M8 6V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2m1 0v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6h8z" /></svg>
                        </span>
                        <span className="uppercase tracking-wider">{t('myBidDeleteLabel')}</span>
                      </button>
                    </div>
                  )
                )}
                {error && (
                  <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{error}</p>
                )}
                {success && (
                  <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">✓ {t('bidPlaced')}</p>
                )}
              </form>
            ) : (
              <a href={loginHref} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#F97316] px-5 py-3 text-sm font-bold text-white shadow-md transition hover:bg-orange-600">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" /></svg>
                {t('signInToBid')}
              </a>
            )
          ) : (
            <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-center text-xs font-semibold text-slate-600">
              {initial.status === 'SCHEDULED' ? t('openSoon') : t('biddingClosed')}
            </p>
          )}
        </div>
      </div>

      {/* Watch + Share moved into the gallery overlay */}

      {/* ── Live bid history (hidden — shown in dedicated dark BidHistory card below) ── */}
      {false && bids.length > 0 && (
        <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/70">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">{t('history')}</h2>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                {t('competing', { count: new Set(bids.map((b) => b.bidderInitial)).size })}
              </p>
            </div>
            {isLive && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                <span className="relative inline-flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                LIVE
              </span>
            )}
          </div>
          <ul ref={listRef} className="max-h-72 space-y-1 overflow-y-auto pe-1">
            {bids.map((b, i) => {
              const isLive0 = i === 0 && b.id.startsWith('live-');
              return (
                <li
                  key={b.id}
                  style={isLive0 ? { animation: 'bid-slide 380ms ease-out' } : undefined}
                  className={`flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm transition ${
                    i === 0
                      ? 'bg-gradient-to-r from-orange-50 to-amber-50/50 ring-1 ring-orange-100'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className={`relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradientFor(b.bidderInitial)} text-[12px] font-black text-white shadow-sm`}>
                      {b.bidderInitial}
                      {i === 0 && isLive && (
                        <span className="absolute -end-0.5 -top-0.5 inline-flex h-3 w-3 items-center justify-center rounded-full bg-[#F97316] text-[8px] font-black text-white ring-2 ring-white">
                          ★
                        </span>
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[11px] font-medium text-slate-600">
                        {relativeTime(new Date(b.createdAt).getTime()) ??
                          new Date(b.createdAt).toLocaleTimeString(locale, { timeStyle: 'short' })}
                      </span>
                      {i === 0 ? (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#F97316]">
                          {t('leadingBid')}
                        </span>
                      ) : (
                        <time className="block text-[10px] text-slate-400" dateTime={b.createdAt}>
                          {new Date(b.createdAt).toLocaleTimeString(locale, { timeStyle: 'short' })}
                        </time>
                      )}
                    </span>
                  </span>
                  <span className={`font-black tabular-nums ${i === 0 ? 'text-base text-[#F97316]' : 'text-[#0F172A]'}`}>
                    {fmt(b.amount, b.currency, locale)}
                  </span>
                </li>
              );
            })}
          </ul>
          <style>{`
            @keyframes bid-slide {
              0%   { opacity: 0; transform: translateY(-12px) scale(0.95); }
              100% { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
