'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Entity = 'category' | 'supplier' | 'product';

type PickerItem = {
  id: string;
  label: string;
  hint?: string;
  imageUrl?: string | null;
};

type Props = {
  entity:        Entity;
  value:         string | null;
  onChange:      (id: string | null) => void;
  label:         string;
  placeholder:   string;
  noneLabel:     string;
  verifiedLabel?: string;
};

const DEBOUNCE_MS = 250;

/**
 * Single-select entity picker with search modal. Reuses the existing
 * /api/admin/homepage/pickers endpoint that powers the homepage builder.
 *
 * Differs from `ItemPicker` (multi) — this stores a single id|null.
 */
export function SingleEntityPicker({
  entity,
  value,
  onChange,
  label,
  placeholder,
  noneLabel,
  verifiedLabel,
}: Props) {
  const [open, setOpen]               = useState(false);
  const [mounted, setMounted]         = useState(false);
  const [resolved, setResolved]       = useState<PickerItem | null>(null);
  const [results, setResults]         = useState<PickerItem[]>([]);
  const [query, setQuery]             = useState('');
  const [loadingResolved, setLoadingR] = useState(false);
  const [loadingResults, setLoadingS]  = useState(false);
  const lastQuery = useRef('');

  useEffect(() => setMounted(true), []);

  /* Resolve the current value's metadata. */
  useEffect(() => {
    if (!value) { setResolved(null); return; }
    let cancelled = false;
    setLoadingR(true);
    fetch(`/api/admin/homepage/pickers?type=${entity}&ids=${encodeURIComponent(value)}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((j: { data: PickerItem[] }) => { if (!cancelled) setResolved(j.data[0] ?? null); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingR(false); });
    return () => { cancelled = true; };
  }, [entity, value]);

  /* Debounced search. */
  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(() => {
      lastQuery.current = query;
      setLoadingS(true);
      fetch(`/api/admin/homepage/pickers?type=${entity}&q=${encodeURIComponent(query)}`)
        .then((r) => r.ok ? r.json() : Promise.reject(r))
        .then((j: { data: PickerItem[] }) => { if (lastQuery.current === query) setResults(j.data); })
        .catch(() => {})
        .finally(() => setLoadingS(false));
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [open, query, entity]);

  /* ESC + body scroll lock */
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function pick(id: string) { onChange(id); setOpen(false); }

  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-700">{label}</span>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex flex-1 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-start transition hover:border-orange-300"
        >
          {value && resolved ? (
            <>
              <Thumb item={resolved} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-slate-900">{resolved.label}</span>
                {resolved.hint && <span className="block truncate text-[11px] text-slate-500">{resolved.hint}</span>}
              </span>
              {verifiedLabel && resolved.hint?.toLowerCase().includes('verified') && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  <CheckIcon className="h-2.5 w-2.5" />
                  {verifiedLabel}
                </span>
              )}
            </>
          ) : value && loadingResolved ? (
            <span className="text-xs text-slate-500">Loading…</span>
          ) : (
            <span className="text-slate-400">{noneLabel}</span>
          )}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="rounded-md border border-slate-200 px-2 py-2 text-xs text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
            title="Clear"
          >
            <XIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && mounted && createPortal(
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button type="button" aria-label="Close" onClick={() => setOpen(false)}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
          <div className="relative flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <h3 className="text-sm font-bold text-slate-900">{label}</h3>
              <button type="button" onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-700"><XIcon className="h-5 w-5" /></button>
            </header>
            <div className="border-b border-slate-100 p-3">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-orange-400 focus:bg-white focus:ring-1 focus:ring-orange-300"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <ul className="divide-y divide-slate-100">
                <li>
                  <button type="button" onClick={() => { onChange(null); setOpen(false); }}
                    className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-start transition hover:bg-slate-50">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-300">—</span>
                    <span className="text-sm font-medium text-slate-700">{noneLabel}</span>
                  </button>
                </li>
                {loadingResults && results.length === 0 && (
                  <li className="px-2 py-3 text-xs text-slate-500">Loading…</li>
                )}
                {!loadingResults && results.length === 0 && (
                  <li className="px-2 py-3 text-xs text-slate-500">No results.</li>
                )}
                {results.map((it) => (
                  <li key={it.id}>
                    <button type="button" onClick={() => pick(it.id)}
                      className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-start transition hover:bg-orange-50 ${
                        value === it.id ? 'bg-orange-50/50' : ''
                      }`}>
                      <Thumb item={it} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{it.label}</p>
                        {it.hint && <p className="truncate text-[11px] text-slate-500">{it.hint}</p>}
                      </div>
                      {value === it.id && <CheckIcon className="h-4 w-4 text-orange-600" />}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>,
        document.body
      )}
    </label>
  );
}

function Thumb({ item }: { item: PickerItem }) {
  if (item.imageUrl) {
    /* eslint-disable-next-line @next/next/no-img-element */
    return <img src={item.imageUrl} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover ring-1 ring-slate-200" />;
  }
  return (
    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] font-bold uppercase text-slate-500 ring-1 ring-slate-200">
      {item.label?.slice(0, 2) ?? '··'}
    </span>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>;
}
function XIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 6 6 18M6 6l12 12" /></svg>;
}
