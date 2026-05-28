'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';

import type { RangePreset } from '@/lib/analytics/types';

type Props = {
  current: RangePreset;
  labels: Record<RangePreset, string>;
  customFromLabel: string;
  customToLabel: string;
  applyLabel: string;
};

/**
 * URL-backed date-range filter. Writes `?preset=…[&from=&to=]` so the page
 * can be bookmarked, shared, or reloaded without state loss.
 *
 * Uses `router.replace` + `useTransition` for a snappy client-side feel
 * while the RSC re-fetches its analytics payload in the background.
 */
export function DateRangeFilter({
  current,
  labels,
  customFromLabel,
  customToLabel,
  applyLabel
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [showCustom, setShowCustom] = useState(current === 'custom');
  const [from, setFrom] = useState(searchParams.get('from') ?? '');
  const [to, setTo] = useState(searchParams.get('to') ?? '');

  const setPreset = (preset: RangePreset) => {
    const params = new URLSearchParams();
    params.set('preset', preset);
    if (preset === 'custom') {
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      setShowCustom(true);
    } else {
      setShowCustom(false);
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  const applyCustom = () => {
    if (!from || !to) return;
    const params = new URLSearchParams();
    params.set('preset', 'custom');
    params.set('from', from);
    params.set('to', to);
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  const presets: RangePreset[] = ['today', '7d', '30d', 'custom'];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        className={
          'inline-flex rounded-xl bg-slate-100 p-1 transition-opacity ' +
          (isPending ? 'opacity-60' : 'opacity-100')
        }
      >
        {presets.map((preset) => {
          const active = current === preset;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => setPreset(preset)}
              className={
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150 ' +
                (active
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900')
              }
            >
              {labels[preset]}
            </button>
          );
        })}
      </div>

      {showCustom ? (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <span>{customFromLabel}</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:border-slate-400 focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <span>{customToLabel}</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:border-slate-400 focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={applyCustom}
            disabled={!from || !to || isPending}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {applyLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
