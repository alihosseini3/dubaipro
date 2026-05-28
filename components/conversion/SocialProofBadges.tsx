'use client';

import { useEffect, useRef, useState } from 'react';
import type { SocialProofData } from '@/lib/conversion/social-proof';

type Props = {
  data: SocialProofData;
};

/**
 * Subtle conversion nudges: viewing count, sold today, trending badge.
 * Client component so the viewing counter can drift over time.
 */
export function SocialProofBadges({ data }: Props) {
  const [viewing, setViewing] = useState(data.viewing);
  const [pulsed, setPulsed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function drift() {
      setViewing((v) => {
        const delta = Math.random() < 0.5 ? 1 : -1;
        return Math.max(2, Math.min(30, v + delta));
      });
      setPulsed(true);
      setTimeout(() => setPulsed(false), 600);
      timerRef.current = setTimeout(drift, 8_000 + Math.random() * 12_000);
    }
    timerRef.current = setTimeout(drift, 12_000 + Math.random() * 8_000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium">
      {/* Trending badge */}
      {data.isTrending && (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-red-600 ring-1 ring-red-200">
          <span>🔥</span>
          <span>Trending</span>
        </span>
      )}

      {/* Currently viewing */}
      <span
        className={`inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-amber-700 ring-1 ring-amber-200 transition-all duration-300 ${
          pulsed ? 'scale-105' : 'scale-100'
        }`}
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
        </span>
        <span>{viewing} people viewing</span>
      </span>

      {/* Sold today */}
      {data.soldToday > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700 ring-1 ring-emerald-200">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3" aria-hidden>
            <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3z" />
          </svg>
          <span>{data.soldToday} sold today</span>
        </span>
      )}

      {/* New arrival */}
      {data.isNew && (
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-600 ring-1 ring-indigo-200">
          <span>✨</span>
          <span>New</span>
        </span>
      )}
    </div>
  );
}
