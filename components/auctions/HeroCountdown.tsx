'use client';

import { useEffect, useState } from 'react';

type Props = {
  endsAt: string;
  initialParts: {
    days: number;
    hours: number;
    mins: number;
    secs: number;
    diff: number;
  };
  label?: string;
  className?: string;
};

function parts(endsAt: string) {
  const diff = Math.max(0, new Date(endsAt).getTime() - Date.now());
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  const secs = Math.floor((diff % 60_000) / 1_000);
  return { days, hours, mins, secs, diff };
}

const pad = (n: number) => String(n).padStart(2, '0');

export function HeroCountdown({ endsAt, initialParts, label = 'ENDS IN', className = '' }: Props) {
  const [t, setT] = useState(initialParts);

  useEffect(() => {
    const sync = () => setT(parts(endsAt));
    sync();
    const id = setInterval(() => setT(parts(endsAt)), 1_000);
    return () => clearInterval(id);
  }, [endsAt]);

  const urgent = t.diff > 0 && t.diff < 30 * 60_000;
  const ended = t.diff <= 0;

  const segments: Array<{ value: number; label: string }> = [
    { value: t.days, label: 'Days' },
    { value: t.hours, label: 'Hours' },
    { value: t.mins, label: 'Mins' },
    { value: t.secs, label: 'Secs' },
  ];

  return (
    <div className={`shrink-0 ${className}`}>
      <p className="mb-2 text-end text-[10px] font-black uppercase tracking-[0.24em] text-white/45">
        {ended ? 'AUCTION ENDED' : label}
      </p>
      <div className="flex items-center gap-2">
        {segments.map((seg, i) => (
          <div key={seg.label} className="flex items-center gap-2">
            <div className={`flex min-w-[58px] flex-col items-center rounded-xl border border-white/10 ${urgent ? 'bg-rose-500/20' : 'bg-white/5'} px-3 py-2 backdrop-blur-xl`}>
              <span className={`font-mono text-2xl font-black tabular-nums leading-none ${urgent ? 'text-rose-200' : 'text-white'}`}>
                {pad(seg.value)}
              </span>
              <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-white/45">{seg.label}</span>
            </div>
            {i < segments.length - 1 && <span className="text-white/25">:</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
