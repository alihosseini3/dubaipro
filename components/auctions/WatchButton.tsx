'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';

type Props = {
  auctionId: string;
  initialWatching: boolean;
  initialCount: number;
  /** Null when user is not logged in */
  loginHref: string;
  loggedIn: boolean;
  variant?: 'default' | 'gallery';
};

export function WatchButton({
  auctionId,
  initialWatching,
  initialCount,
  loginHref,
  loggedIn,
  variant = 'default',
}: Props) {
  const t = useTranslations('auctions.detail');
  const [watching, setWatching] = useState(initialWatching);
  const [count, setCount] = useState(initialCount);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    if (!loggedIn) {
      window.location.href = loginHref;
      return;
    }
    startTransition(async () => {
      const method = watching ? 'DELETE' : 'POST';
      const res = await fetch(`/api/auctions/${auctionId}/watch`, { method }).catch(() => null);
      if (!res?.ok) return;
      const json = await res.json() as { data: { watching: boolean; watcherCount: number } };
      setWatching(json.data.watching);
      setCount(json.data.watcherCount);
    });
  }

  if (variant === 'gallery') {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={isPending}
        className={`inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl px-2.5 text-[11px] font-bold backdrop-blur shadow-md transition disabled:opacity-60 ${
          watching
            ? 'bg-orange-500 text-white hover:bg-orange-600'
            : 'bg-black/55 text-white hover:bg-black/75'
        }`}
        aria-pressed={watching}
      >
        <svg viewBox="0 0 24 24" fill={watching ? 'currentColor' : 'none'}
          stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5" aria-hidden>
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        {watching ? t('watching') : t('watch')}
        <span className="rounded-full bg-white/20 px-1.5 text-[10px] font-black">{count}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
        watching
          ? 'border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100'
          : 'border-slate-200 bg-white text-slate-600 hover:border-orange-200 hover:text-orange-700'
      }`}
    >
      <svg viewBox="0 0 24 24" fill={watching ? 'currentColor' : 'none'}
        stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      {watching ? t('watching') : t('watch')}
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
        {count}
      </span>
    </button>
  );
}
