'use client';

import { useState, type ReactNode } from 'react';

type Item = {
  title: string;
  description: string;
  icon?: string;
};

type Props = {
  values: Item[];
  onChange: (next: Item[]) => void;
};

const ICON_KEYS = ['shield', 'lock', 'truck', 'tag', 'globe', 'bolt'] as const;

/**
 * Editor for `TrustConfig.items` — a list of `{ title, description, icon }`
 * rows. Items are expanded inline so admins can edit fields directly.
 * Supports add/remove/reorder, with a 6-row hard cap matching the
 * available accent palettes.
 */
export function TrustItemsEditor({ values, onChange }: Props) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const max = 6;

  function patch(i: number, partial: Partial<Item>) {
    const next = values.slice();
    next[i] = { ...next[i], ...partial };
    onChange(next);
  }

  function add() {
    if (values.length >= max) return;
    const next = [
      ...values,
      { title: '', description: '', icon: ICON_KEYS[values.length % ICON_KEYS.length] }
    ];
    onChange(next);
    setExpandedIdx(next.length - 1);
  }

  function removeAt(i: number) {
    const next = values.slice();
    next.splice(i, 1);
    onChange(next);
    if (expandedIdx === i) setExpandedIdx(null);
  }

  function move(i: number, delta: number) {
    const j = i + delta;
    if (j < 0 || j >= values.length) return;
    const next = values.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  return (
    <SectionWrap label="Trust badges" count={`${values.length}/${max}`}>
      <ul className="space-y-2">
        {values.map((item, i) => {
          const open = expandedIdx === i;
          return (
            <li
              key={i}
              className="overflow-hidden rounded-lg border border-slate-200 bg-white"
            >
              <div className="flex items-center gap-2 px-3 py-2">
                <span className="rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-violet-700">
                  {item.icon ?? '—'}
                </span>
                <span className="flex-1 truncate text-sm font-medium text-slate-800">
                  {item.title || <em className="text-slate-400">Untitled badge</em>}
                </span>
                <ItemActions
                  onUp={() => move(i, -1)}
                  onDown={() => move(i, 1)}
                  upDisabled={i === 0}
                  downDisabled={i >= values.length - 1}
                  onToggle={() => setExpandedIdx(open ? null : i)}
                  onRemove={() => removeAt(i)}
                  open={open}
                />
              </div>

              {open && (
                <div className="grid gap-3 border-t border-slate-100 bg-slate-50/60 p-3 sm:grid-cols-2">
                  <SmallField label="Title">
                    <input
                      value={item.title}
                      onChange={(e) => patch(i, { title: e.target.value })}
                      maxLength={80}
                      className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
                    />
                  </SmallField>
                  <SmallField label="Icon">
                    <select
                      value={item.icon ?? 'shield'}
                      onChange={(e) => patch(i, { icon: e.target.value })}
                      className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
                    >
                      {ICON_KEYS.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </SmallField>
                  <SmallField label="Description" full>
                    <textarea
                      value={item.description}
                      onChange={(e) => patch(i, { description: e.target.value })}
                      rows={2}
                      maxLength={200}
                      className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
                    />
                  </SmallField>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {values.length < max && (
        <button
          type="button"
          onClick={add}
          className="mt-2 inline-flex h-9 items-center rounded-md border border-dashed border-slate-300 bg-white px-4 text-xs font-bold text-slate-700 transition hover:border-orange-400 hover:bg-orange-50 hover:text-orange-700"
        >
          + Add badge
        </button>
      )}
    </SectionWrap>
  );
}

/* -------- Small reusable bits used by every nested editor -------- */

export function SectionWrap({
  label,
  count,
  children
}: {
  label: string;
  count?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2 sm:col-span-2">
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </span>
        {count && <span className="text-[10px] text-slate-400">{count}</span>}
      </div>
      {children}
    </div>
  );
}

export function SmallField({
  label,
  full,
  children
}: {
  label: string;
  full?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={`block ${full ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1 block text-[11px] font-semibold text-slate-600">
        {label}
      </span>
      {children}
    </label>
  );
}

export function ItemActions({
  onUp,
  onDown,
  upDisabled,
  downDisabled,
  onToggle,
  onRemove,
  open
}: {
  onUp: () => void;
  onDown: () => void;
  upDisabled: boolean;
  downDisabled: boolean;
  onToggle: () => void;
  onRemove: () => void;
  open: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <IconBtn label="Move up" onClick={onUp} disabled={upDisabled}>
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m6 15 6-6 6 6" />
        </svg>
      </IconBtn>
      <IconBtn label="Move down" onClick={onDown} disabled={downDisabled}>
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </IconBtn>
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex h-7 items-center rounded-md border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        {open ? 'Close' : 'Edit'}
      </button>
      <IconBtn label="Remove" onClick={onRemove} variant="danger">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </IconBtn>
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  variant,
  children
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'danger';
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition disabled:opacity-30 ${
        variant === 'danger'
          ? 'text-slate-400 hover:bg-rose-50 hover:text-rose-600'
          : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  );
}
