'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import { SUPPORTED_CURRENCIES } from '@/types/currency';
import type { Currency } from '@/types/currency';

type Meta = { code: Currency; symbol: string; name: string };

const META: Record<Currency, Meta> = {
  USD: { code: 'USD', symbol: '$', name: 'US Dollar' },
  AED: { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  IRR: { code: 'IRR', symbol: '﷼', name: 'Iranian Toman' }
};

type Props = {
  /** Initial value resolved server-side (cookie ?? locale default). */
  value: Currency;
  tone?: 'dark' | 'light';
  size?: 'sm' | 'lg';
};

/**
 * Premium currency switcher — matches the locale switcher's dropdown
 * UX so the two feel like a pair. Persists the choice via
 * `POST /api/currency` (1-year cookie) and refreshes the route so all
 * `<Price>` components re-render in the new currency.
 */
export function CurrencySwitcher({
  value,
  tone = 'dark',
  size = 'sm'
}: Props) {
  const router = useRouter();
  const [current, setCurrent] = useState<Currency>(value);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);

  const isLight = tone === 'light';
  const large = size === 'lg';
  const m = META[current] ?? META.USD;

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function pick(next: Currency) {
    setOpen(false);
    if (next === current) return;
    setCurrent(next); // optimistic
    try {
      await fetch('/api/currency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: next })
      });
    } catch {
      // Revert on error so the UI doesn't lie about persistence.
      setCurrent(value);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Currency"
        className={
          isLight
            ? `inline-flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:opacity-60 ${large ? 'min-h-[48px] text-[15px]' : ''}`
            : 'inline-flex h-7 items-center gap-1.5 rounded-md px-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/5 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:opacity-60'
        }
      >
        <span className="font-semibold leading-none">{m.symbol}</span>
        <span className={isLight ? 'flex-1 text-start' : ''}>{m.code}</span>
        <ChevronDownIcon
          className={`h-3.5 w-3.5 opacity-70 transition ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Currency"
          className={`absolute end-0 z-50 mt-2 min-w-[200px] overflow-hidden rounded-xl bg-white p-1 shadow-xl ring-1 ring-black/5 ${
            isLight ? 'start-0' : ''
          }`}
          style={{ animation: 'fadeIn 150ms ease-out' }}
        >
          {SUPPORTED_CURRENCIES.map((c) => {
            const r = META[c];
            const active = c === current;
            return (
              <li key={c}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => void pick(c)}
                  className={`group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                    active
                      ? 'bg-orange-50 font-semibold text-orange-700'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="inline-flex h-6 w-7 items-center justify-center rounded-md bg-slate-100 text-[13px] font-bold text-slate-700 group-hover:bg-white">
                    {r.symbol}
                  </span>
                  <span className="flex-1 text-start">
                    <span className="block font-semibold leading-none">{r.code}</span>
                    <span className="mt-0.5 block text-[11px] font-normal text-slate-500">
                      {r.name}
                    </span>
                  </span>
                  {active && (
                    <CheckIcon className="h-4 w-4 text-orange-600" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m5 12 5 5 9-11" />
    </svg>
  );
}
