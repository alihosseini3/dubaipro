'use client';

import { useEffect, useState } from 'react';

type Props = { endsAt: string; className?: string };

function parseDelta(endsAt: string) {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1_000);
  return { h, m, s, diff };
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function CountdownTimer({ endsAt, className = '' }: Props) {
  const [delta, setDelta] = useState<ReturnType<typeof parseDelta> | null>(null);

  useEffect(() => {
    setDelta(parseDelta(endsAt));
    const id = setInterval(() => setDelta(parseDelta(endsAt)), 1_000);
    return () => clearInterval(id);
  }, [endsAt]);

  if (delta === null) {
    return (
      <span className={`inline-flex items-center gap-1 font-mono tabular-nums ${className}`} aria-hidden>
        <span className="rounded-lg bg-slate-100 px-2 py-1 text-transparent">00</span>
        <span className="text-transparent">:</span>
        <span className="rounded-lg bg-slate-100 px-2 py-1 text-transparent">00</span>
      </span>
    );
  }

  if (!delta) {
    return <span className={`font-mono text-sm font-bold text-slate-400 ${className}`}>—</span>;
  }

  const urgent = delta.diff < 5 * 60_000;
  const warning = delta.diff < 30 * 60_000;
  const box = urgent
    ? 'bg-rose-600 text-white shadow-[0_0_18px_rgba(225,29,72,0.35)]'
    : warning
      ? 'bg-orange-500 text-white shadow-[0_0_16px_rgba(249,115,22,0.3)]'
      : 'bg-slate-950 text-white shadow-sm';
  const label = urgent ? 'text-rose-500' : warning ? 'text-orange-500' : 'text-slate-400';

  return (
    <span className={`inline-flex items-center gap-1.5 font-mono font-black tabular-nums ${urgent ? 'animate-pulse' : ''} ${className}`}>
      {delta.h > 0 && (
        <>
          <span className={`rounded-lg px-2 py-1 transition ${box}`}>{pad(delta.h)}</span>
          <span className={label}>:</span>
        </>
      )}
      <span className={`rounded-lg px-2 py-1 transition ${box}`}>{pad(delta.m)}</span>
      <span className={label}>:</span>
      <span className={`rounded-lg px-2 py-1 transition ${box}`}>{pad(delta.s)}</span>
    </span>
  );
}
