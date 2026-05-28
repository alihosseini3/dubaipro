'use client';

/**
 * Dual-thumb range slider with paired number inputs. Used for both the
 * price filter and any `number`-typed attribute range.
 *
 * Design decisions:
 *   1. Controlled: parent owns the final committed value. We mirror a
 *      local copy for drag-in-progress so the URL doesn't thrash.
 *   2. Commit-on-blur + Enter key — matches behaviour shoppers expect
 *      from Booking.com / Zalando.
 *   3. Two overlapped `<input type=range>` elements: the "invisible"
 *      thumbs sit on top of the custom track so screen readers + keyboard
 *      navigation stay fully functional out of the box.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

type Props = {
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  onCommit: (range: [number, number]) => void;
  unit?: string | null;
  /** Accessible labels for the low/high thumb (localised by the parent). */
  minAriaLabel: string;
  maxAriaLabel: string;
  /** Button label for the "apply" CTA; tapping it commits the current range. */
  applyLabel: string;
};

export function RangeSlider({
  min,
  max,
  step = 1,
  value,
  onCommit,
  unit,
  minAriaLabel,
  maxAriaLabel,
  applyLabel,
}: Props) {
  const [lo, setLo] = useState(value[0]);
  const [hi, setHi] = useState(value[1]);

  // Keep the local state in sync when the parent updates (e.g. clear all).
  const lastExternal = useRef<string>('');
  useEffect(() => {
    const sig = `${value[0]}:${value[1]}`;
    if (sig !== lastExternal.current) {
      lastExternal.current = sig;
      setLo(value[0]);
      setHi(value[1]);
    }
  }, [value]);

  const range = max - min || 1;
  const minPct = Math.max(0, Math.min(100, ((lo - min) / range) * 100));
  const maxPct = Math.max(0, Math.min(100, ((hi - min) / range) * 100));

  const commit = useCallback(
    (next: [number, number]) => {
      const clampedLo = Math.max(min, Math.min(next[0], next[1] - step));
      const clampedHi = Math.min(max, Math.max(next[1], next[0] + step));
      onCommit([clampedLo, clampedHi]);
    },
    [min, max, step, onCommit]
  );

  // Debounced commit during drag — avoids URL thrash but stays responsive.
  const dragTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueCommit = useCallback(
    (next: [number, number]) => {
      if (dragTimer.current) clearTimeout(dragTimer.current);
      dragTimer.current = setTimeout(() => commit(next), 250);
    },
    [commit]
  );

  useEffect(() => () => {
    if (dragTimer.current) clearTimeout(dragTimer.current);
  }, []);

  const fmt = (n: number) => (unit ? `${n.toLocaleString()} ${unit}` : n.toLocaleString());

  return (
    <div className="space-y-2.5">
      <style>{`
        .dp-range::-webkit-slider-thumb{pointer-events:auto;-webkit-appearance:none;height:1.125rem;width:1.125rem;border-radius:9999px;background:#fff;border:2.5px solid #F97316;box-shadow:0 1px 4px rgba(249,115,22,.35);cursor:pointer}
        .dp-range::-moz-range-thumb{pointer-events:auto;appearance:none;height:1.125rem;width:1.125rem;border-radius:9999px;background:#fff;border:2.5px solid #F97316;box-shadow:0 1px 4px rgba(249,115,22,.35);cursor:pointer}
      `}</style>

      <div className="relative h-5 w-full">
        <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-slate-200" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-orange-400 to-orange-500"
          style={{ left: `${minPct}%`, right: `${100 - maxPct}%` }}
        />
        <input
          type="range"
          aria-label={minAriaLabel}
          min={min}
          max={max}
          step={step}
          value={lo}
          onChange={(e) => {
            const v = Math.min(Number(e.target.value), hi - step);
            setLo(v);
            queueCommit([v, hi]);
          }}
          className="dp-range pointer-events-none absolute inset-0 h-full w-full appearance-none bg-transparent"
        />
        <input
          type="range"
          aria-label={maxAriaLabel}
          min={min}
          max={max}
          step={step}
          value={hi}
          onChange={(e) => {
            const v = Math.max(Number(e.target.value), lo + step);
            setHi(v);
            queueCommit([lo, v]);
          }}
          className="dp-range pointer-events-none absolute inset-0 h-full w-full appearance-none bg-transparent"
        />
      </div>

      <div className="flex items-center gap-2">
        <label className="flex-1">
          <span className="sr-only">{minAriaLabel}</span>
          <input
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            step={step}
            value={lo}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) setLo(v);
            }}
            onBlur={() => commit([lo, hi])}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit([lo, hi]);
            }}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
          />
        </label>
        <span className="text-slate-300">–</span>
        <label className="flex-1">
          <span className="sr-only">{maxAriaLabel}</span>
          <input
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            step={step}
            value={hi}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) setHi(v);
            }}
            onBlur={() => commit([lo, hi])}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit([lo, hi]);
            }}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
          />
        </label>
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <span>{fmt(min)}</span>
        <span>{fmt(max)}</span>
      </div>

      <button
        type="button"
        onClick={() => commit([lo, hi])}
        className="w-full rounded-xl bg-orange-500 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 active:bg-orange-700"
      >
        {applyLabel}
      </button>
    </div>
  );
}
