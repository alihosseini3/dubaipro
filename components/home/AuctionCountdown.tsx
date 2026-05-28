'use client';

import { useEffect, useState } from 'react';

type Props = { endsAt: string };

/**
 * Live "ends in HH:MM:SS" countdown for auction cards.
 *
 * Why a tiny dedicated client component? The rest of `AuctionSection`
 * is server-rendered (no JS shipped) — we localise the interactivity
 * to just the time string so the page stays cheap. State updates are
 * driven by a single 1-second `setInterval` that auto-stops once the
 * deadline passes.
 */
export function AuctionCountdown({ endsAt }: Props) {
  const target = new Date(endsAt).getTime();
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (Number.isNaN(target)) return;
    // Compute on client only to avoid server/client mismatch
    setRemaining(target - Date.now());
    if (target <= Date.now()) return;
    const id = window.setInterval(() => {
      const next = target - Date.now();
      setRemaining(next);
      if (next <= 0) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
  }, [target]);

  // null on server and before first client paint → no mismatch
  if (Number.isNaN(target) || remaining === null) return null;

  const ended = remaining <= 0;
  const days = Math.max(0, Math.floor(remaining / 86_400_000));
  const hours = Math.max(0, Math.floor((remaining % 86_400_000) / 3_600_000));
  const minutes = Math.max(0, Math.floor((remaining % 3_600_000) / 60_000));
  const seconds = Math.max(0, Math.floor((remaining % 60_000) / 1000));

  if (ended) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-rose-700">
        Ended
      </span>
    );
  }

  const parts =
    days > 0
      ? [`${days}d`, pad(hours), pad(minutes)]
      : [pad(hours), pad(minutes), pad(seconds)];

  return (
    <span
      className="inline-flex items-center gap-1 rounded-md bg-orange-50 px-2 py-1 text-[11px] font-bold tabular-nums tracking-wider text-orange-700"
      aria-label={`Ends in ${parts.join(':')}`}
    >
      <DotIcon className="h-2 w-2 animate-pulse text-orange-500" />
      {parts.join(':')}
    </span>
  );
}

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function DotIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <circle cx="12" cy="12" r="6" />
    </svg>
  );
}
