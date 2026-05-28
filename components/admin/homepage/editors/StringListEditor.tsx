'use client';

import { useState } from 'react';

type Props = {
  label: string;
  /** Helper line shown under the label. */
  hint?: string;
  /** Placeholder shown inside the "add" input. */
  placeholder?: string;
  /** Maximum number of items the editor will let admins add. */
  max?: number;
  /** Per-item character cap. */
  maxLength?: number;
  values: string[];
  onChange: (next: string[]) => void;
};

/**
 * Compact list editor for `string[]` configs (Hero chips, supplier
 * benefits, etc). Add via Enter or button click; remove with the X
 * button on each chip. Order is preserved as the admin types — we
 * deliberately don't add drag/drop here since these lists are small
 * (3–5 items) and reorder via delete-and-readd is fine.
 */
export function StringListEditor({
  label,
  hint,
  placeholder,
  max = 8,
  maxLength = 80,
  values,
  onChange
}: Props) {
  const [draft, setDraft] = useState('');

  function add() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (values.length >= max) return;
    onChange([...values, trimmed.slice(0, maxLength)]);
    setDraft('');
  }

  function removeAt(i: number) {
    const next = values.slice();
    next.splice(i, 1);
    onChange(next);
  }

  function moveUp(i: number) {
    if (i === 0) return;
    const next = values.slice();
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    onChange(next);
  }

  function moveDown(i: number) {
    if (i >= values.length - 1) return;
    const next = values.slice();
    [next[i + 1], next[i]] = [next[i], next[i + 1]];
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <div>
        <span className="block text-xs font-semibold text-slate-700">
          {label}{' '}
          <span className="text-[10px] font-normal text-slate-400">
            {values.length}/{max}
          </span>
        </span>
        {hint && <span className="mt-0.5 block text-[11px] text-slate-500">{hint}</span>}
      </div>

      {values.length > 0 && (
        <ul className="space-y-1.5">
          {values.map((v, i) => (
            <li
              key={`${i}-${v}`}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5"
            >
              <span className="flex-1 truncate text-sm text-slate-800">{v}</span>
              <button
                type="button"
                onClick={() => moveUp(i)}
                disabled={i === 0}
                aria-label="Move up"
                className="text-slate-400 transition hover:text-slate-700 disabled:opacity-30"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="m6 15 6-6 6 6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => moveDown(i)}
                disabled={i >= values.length - 1}
                aria-label="Move down"
                className="text-slate-400 transition hover:text-slate-700 disabled:opacity-30"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label="Remove"
                className="text-slate-400 transition hover:text-rose-600"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      {values.length < max && (
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
            placeholder={placeholder ?? 'Add a value and press Enter'}
            maxLength={maxLength}
            className="block flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
          />
          <button
            type="button"
            onClick={add}
            disabled={!draft.trim()}
            className="inline-flex h-9 items-center rounded-md bg-slate-900 px-3 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}
