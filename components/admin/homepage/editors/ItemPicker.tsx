'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { SectionWrap, SmallField } from './TrustItemsEditor';

type Entity = 'product' | 'category' | 'supplier' | 'post';

type PickerItem = {
  id: string;
  label: string;
  hint?: string;
  imageUrl?: string | null;
};

type Props = {
  entity: Entity;
  /** Currently pinned IDs (in display order). */
  value: string[];
  onChange: (next: string[]) => void;
  label: string;
  hint?: string;
  /** Soft cap. Pinning more than this disables the "Add" buttons. */
  max?: number;
};

const DEBOUNCE_MS = 250;

/**
 * Generic admin picker for `string[]` ID lists. Powers
 * `FEATURED_PRODUCTS.productIds`, `CATEGORIES.categoryIds`,
 * `TOP_SUPPLIERS.supplierIds`, and `BLOG.postIds`.
 *
 *   - Inline summary chip showing how many items are pinned.
 *   - Click "Manage" → portal modal with a search box and a
 *     selected-list with reorder + remove.
 *   - Selected labels are resolved via `?ids=` so freshly-loaded
 *     selections show the real entity name instead of a raw cuid.
 */
export function ItemPicker({
  entity,
  value,
  onChange,
  label,
  hint,
  max = 16
}: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [resolved, setResolved] = useState<PickerItem[]>([]);
  const [results, setResults] = useState<PickerItem[]>([]);
  const [query, setQuery] = useState('');
  const [loadingResolved, setLoadingResolved] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastQuery = useRef('');

  // SSR-safe portal target.
  useEffect(() => setMounted(true), []);

  // Resolve selection labels whenever `value` changes (or on first
  // open). Empty selection short-circuits to avoid a wasted request.
  useEffect(() => {
    if (value.length === 0) {
      setResolved([]);
      return;
    }
    let cancelled = false;
    setLoadingResolved(true);
    setError(null);
    fetch(
      `/api/admin/homepage/pickers?type=${entity}&ids=${encodeURIComponent(value.join(','))}`
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((j: { data: PickerItem[] }) => {
        if (!cancelled) setResolved(j.data);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load selection.');
      })
      .finally(() => {
        if (!cancelled) setLoadingResolved(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entity, value]);

  // Debounced search while the modal is open.
  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(() => {
      lastQuery.current = query;
      setLoadingResults(true);
      setError(null);
      fetch(
        `/api/admin/homepage/pickers?type=${entity}&q=${encodeURIComponent(query)}`
      )
        .then((r) => (r.ok ? r.json() : Promise.reject(r)))
        .then((j: { data: PickerItem[] }) => {
          // Drop stale responses if the user kept typing.
          if (lastQuery.current === query) setResults(j.data);
        })
        .catch(() => setError('Search failed.'))
        .finally(() => setLoadingResults(false));
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [open, query, entity]);

  // Body scroll lock while the modal is open.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function add(id: string) {
    if (value.includes(id)) return;
    if (value.length >= max) return;
    onChange([...value, id]);
  }

  function remove(id: string) {
    onChange(value.filter((x) => x !== id));
  }

  function move(idx: number, delta: number) {
    const j = idx + delta;
    if (j < 0 || j >= value.length) return;
    const next = value.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  }

  return (
    <SectionWrap label={label}>
      {hint && <p className="-mt-1 text-[11px] text-slate-500">{hint}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-orange-400 hover:bg-orange-50 hover:text-orange-700"
        >
          {value.length === 0 ? 'Pin items' : `Manage (${value.length})`}
        </button>
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="inline-flex h-9 items-center rounded-md border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
          >
            Clear
          </button>
        )}
      </div>

      {/* Live preview of the current selection in display order. */}
      {value.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {value.map((id, i) => {
            const meta = resolved.find((r) => r.id === id);
            return (
              <li
                key={id}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5"
              >
                <Thumb item={meta ?? null} />
                <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                  {meta?.label ??
                    (loadingResolved ? 'Loading…' : <em>(missing) {id}</em>)}
                </span>
                {meta?.hint && (
                  <span className="hidden shrink-0 text-[11px] text-slate-500 sm:inline">
                    {meta.hint}
                  </span>
                )}
                <UpDown
                  onUp={() => move(i, -1)}
                  onDown={() => move(i, 1)}
                  upDisabled={i === 0}
                  downDisabled={i >= value.length - 1}
                />
                <button
                  type="button"
                  onClick={() => remove(id)}
                  aria-label="Remove"
                  className="text-slate-400 transition hover:text-rose-600"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Modal */}
      {open &&
        mounted &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          >
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
              <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{label}</h3>
                  <p className="text-[11px] text-slate-500">
                    {value.length}/{max} pinned
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-9 items-center rounded-md bg-orange-500 px-4 text-xs font-bold text-white transition hover:bg-orange-600"
                >
                  Done
                </button>
              </header>

              <div className="flex-1 overflow-y-auto px-5 py-4">
                <SmallField label="Search">
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Type to filter…"
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
                  />
                </SmallField>

                {error && (
                  <p className="mt-2 rounded-md bg-rose-50 px-2 py-1 text-[11px] text-rose-700">
                    {error}
                  </p>
                )}

                <ul className="mt-3 divide-y divide-slate-100">
                  {loadingResults && results.length === 0 && (
                    <li className="px-1 py-3 text-xs text-slate-500">Loading…</li>
                  )}
                  {!loadingResults && results.length === 0 && (
                    <li className="px-1 py-3 text-xs text-slate-500">
                      No results.
                    </li>
                  )}
                  {results.map((it) => {
                    const picked = value.includes(it.id);
                    const disabled = !picked && value.length >= max;
                    return (
                      <li
                        key={it.id}
                        className={`flex items-center gap-3 px-1 py-2 ${
                          picked ? 'opacity-60' : ''
                        }`}
                      >
                        <Thumb item={it} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {it.label}
                          </p>
                          {it.hint && (
                            <p className="truncate text-[11px] text-slate-500">
                              {it.hint}
                            </p>
                          )}
                        </div>
                        {picked ? (
                          <button
                            type="button"
                            onClick={() => remove(it.id)}
                            className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            Pinned · Remove
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => add(it.id)}
                            disabled={disabled}
                            className="inline-flex h-8 items-center rounded-md bg-slate-900 px-3 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-40"
                          >
                            {disabled ? 'Full' : 'Pin'}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>,
          document.body
        )}
    </SectionWrap>
  );
}

function Thumb({ item }: { item: PickerItem | null }) {
  if (item?.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.imageUrl}
        alt=""
        className="h-9 w-9 shrink-0 rounded-md object-cover ring-1 ring-slate-200"
      />
    );
  }
  return (
    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] font-bold uppercase text-slate-500 ring-1 ring-slate-200">
      {item?.label?.slice(0, 2) ?? '··'}
    </span>
  );
}

function UpDown({
  onUp,
  onDown,
  upDisabled,
  downDisabled
}: {
  onUp: () => void;
  onDown: () => void;
  upDisabled: boolean;
  downDisabled: boolean;
}) {
  return (
    <div className="hidden shrink-0 items-center gap-0.5 sm:flex">
      <button
        type="button"
        onClick={onUp}
        disabled={upDisabled}
        aria-label="Move up"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m6 15 6-6 6 6" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onDown}
        disabled={downDisabled}
        aria-label="Move down"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
    </div>
  );
}

function XIcon({ className }: { className?: string }) {
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
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
