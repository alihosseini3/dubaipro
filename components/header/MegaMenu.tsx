'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';

type Category = {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  /** Pre-formatted "# items" label, resolved server-side. */
  countLabel: string;
};

type Props = {
  locale: string;
  categories: Category[];
  label: string;
  emptyLabel: string;
};

/**
 * Full-width "All Categories" mega menu.
 *
 *  - Desktop: opens on hover (with a small enter/leave delay so a
 *    diagonal mouse path doesn't dismiss it). Click also toggles.
 *  - Mobile/touch: hover events don't fire, so the click handler is
 *    the primary path; the panel stretches to viewport width.
 *  - Closes on Escape, outside click, or route change (Link click).
 *
 * The categories list is server-fetched and passed in as a prop, so
 * the panel itself is a pure client component with no data deps.
 */
export function MegaMenu({
  locale,
  categories,
  label,
  emptyLabel
}: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();

  // Outside click + Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function scheduleClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  }
  function cancelClose() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-10 items-center gap-2 rounded-md bg-white/5 px-3 text-sm font-semibold text-white transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
        {label}
        <svg
          viewBox="0 0 24 24"
          className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          id={id}
          role="menu"
          aria-label={label}
          // Full-width relative to viewport: anchor at start, stretch to end.
          className="fixed inset-x-0 top-auto z-50 mt-2 border-t border-slate-200 bg-white shadow-xl"
          style={{ animation: 'fadeDown 160ms ease-out' }}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <div className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-6 lg:px-8">
            {categories.length === 0 ? (
              <p className="text-sm text-slate-500">{emptyLabel}</p>
            ) : (
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
                {categories.map((c) => (
                  <li key={c.id}>
                    <Link
                      role="menuitem"
                      href={`/${locale}/categories/${c.slug}`}
                      onClick={() => setOpen(false)}
                      className="group flex items-center gap-2.5 rounded-lg px-3 py-2 transition hover:bg-orange-50"
                    >
                      {c.icon ? (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-base transition group-hover:bg-orange-100">
                          {c.icon}
                        </span>
                      ) : (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500 transition group-hover:bg-orange-100">
                          {c.name.slice(0, 1)}
                        </span>
                      )}
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-800 group-hover:text-orange-700">
                          {c.name}
                        </span>
                        <span className="block text-[10px] text-slate-400 group-hover:text-orange-500">
                          {c.countLabel}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
