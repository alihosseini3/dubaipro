'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import type { AuctionBidEvent } from '@/lib/auctions/emitter';
import { CountdownTimer } from './CountdownTimer';

type Props = {
  auctionId:  string;
  status:     'LIVE' | 'SCHEDULED' | 'ENDED' | 'CANCELLED' | 'DRAFT';
  initialBid: number;
  startingBid: number;
  initialEndsAt: string;
  currency:   string;
  locale:     string;
  /** Anchor selector to scroll to when the user taps "Bid" — usually the LiveBidPanel input. */
  scrollTarget?: string;
};

/**
 * Mobile-only sticky bid bar — slides up from the bottom on phones once
 * the user scrolls past the live panel. Mirrors `StickyBuyBar` from the
 * product page so the platform feels coherent.
 */
export function StickyBidBar({
  auctionId,
  status,
  initialBid,
  startingBid,
  initialEndsAt,
  currency,
  locale,
  scrollTarget = '#bid-form',
}: Props) {
  const t = useTranslations('auctions.stickyBar');

  const [visible, setVisible]       = useState(false);
  const [currentBid, setCurrentBid] = useState(initialBid);
  const [endsAt, setEndsAt]         = useState(initialEndsAt);

  /* Show only after the user has scrolled past the inline bid panel. */
  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 480);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* Subscribe to SSE updates so the sticky stays in sync. */
  useEffect(() => {
    if (status !== 'LIVE') return;
    const es = new EventSource(`/api/auctions/${auctionId}/stream`);
    es.addEventListener('bid', (e) => {
      const ev = JSON.parse(e.data) as AuctionBidEvent;
      setCurrentBid(ev.currentBid);
      setEndsAt(ev.endsAt);
    });
    return () => es.close();
  }, [auctionId, status]);

  if (status !== 'LIVE') return null;

  const fmt = new Intl.NumberFormat(locale, {
    style: 'currency', currency, maximumFractionDigits: 0,
  });
  const display = currentBid > 0 ? currentBid : startingBid;

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 py-2.5 shadow-[0_-8px_24px_rgba(2,6,23,0.08)] backdrop-blur transition-transform duration-300 lg:hidden ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
      aria-hidden={!visible}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
            {t('currentBid')}
          </p>
          <p className="truncate text-base font-black tabular-nums text-[#0F172A]">
            {fmt.format(display)}
          </p>
        </div>
        <div className="text-end">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
            {t('ends')}
          </p>
          <CountdownTimer endsAt={endsAt} className="block text-sm" />
        </div>
        <a
          href={scrollTarget}
          className="flex-shrink-0 rounded-xl bg-[#F97316] px-5 py-3 text-sm font-bold text-white shadow-[0_6px_18px_rgba(249,115,22,0.35)] transition active:scale-95"
        >
          {t('bid')}
        </a>
      </div>
    </div>
  );
}
