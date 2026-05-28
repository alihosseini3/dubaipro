'use client';

/**
 * Reusable primitives used by the `FilterPanel` sections. Extracted so new
 * filter types (brand / supplier / attribute) can compose from the same
 * set without each section reinventing accessibility + RTL styling.
 *
 * Every primitive is intentionally stateless — the parent owns the filter
 * state, these just render and emit change events. That keeps disjunctive
 * facet counts + URL syncing trivially correct.
 */

import { useState } from 'react';

/* ─── Iconography (inline, no runtime cost) ─────────────────────────────── */

export function Ico({ d, cls = 'h-3.5 w-3.5' }: { d: string; cls?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cls}
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

export const ICONS = {
  price:    'M12 8c-2 0-3 1-3 2.5S10 13 12 13s3 1 3 2.5S14 18 12 18M12 6v2m0 10v2',
  brand:    'M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18',
  supplier: 'M3 21V9l9-6 9 6v12H3zm6 0v-6h6v6',
  avail:    'M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  chevron:  'M19 9l-7 7-7-7',
  search:   'M21 21l-4.35-4.35M17 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0z',
  filter:   'M3 4a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2a1 1 0 0 1-.293.707L13 13.414V19a1 1 0 0 1-.553.894l-4 2A1 1 0 0 1 7 21v-7.586L3.293 6.707A1 1 0 0 1 3 6V4z',
  close:    'M18 6 6 18M6 6l12 12',
  tag:      'M20 7l-8-4-8 4m16 0-8 4m8-4v10l-8 4m0-10L4 7m8 4v10',
  star:     'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
  spark:    'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L20 12l-6.714 2.143L11 21l-2.286-6.857L2 12l6.714-2.143z',
  discount: 'M9 14l6-6m-5.5.5h.01M14.5 13.5h.01M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0z',
};

/* ─── Section wrapper with collapse/expand ──────────────────────────────── */

export function Section({
  title,
  iconPath,
  children,
  defaultOpen = true,
  badge,
  hint,
}: {
  title: string;
  iconPath: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: number;
  hint?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = `filter-sec-${title.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="group flex w-full items-center gap-2.5 py-3.5 text-left"
        aria-expanded={open}
        aria-controls={contentId}
      >
        <span
          className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg transition-colors ${
            open
              ? 'bg-orange-100 text-orange-600'
              : 'bg-slate-100 text-slate-500 group-hover:bg-orange-50 group-hover:text-orange-500'
          }`}
        >
          <Ico d={iconPath} cls="h-3 w-3" />
        </span>
        <span
          className={`flex-1 text-sm font-semibold transition-colors ${
            open ? 'text-slate-900' : 'text-slate-700 group-hover:text-slate-900'
          }`}
        >
          {title}
        </span>
        {badge != null && badge > 0 && (
          <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
            {badge}
          </span>
        )}
        <Ico
          d={ICONS.chevron}
          cls={`h-3.5 w-3.5 flex-shrink-0 text-slate-400 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      <div
        id={contentId}
        className={`overflow-hidden transition-all duration-200 ease-in-out ${
          open ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="pb-4">
          {hint && <p className="mb-2 text-[11px] leading-relaxed text-slate-500">{hint}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}

/* ─── Checkbox row ───────────────────────────────────────────────────────── */

export function CheckboxRow({
  id,
  label,
  count,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  count?: number;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors ${
        disabled
          ? 'cursor-not-allowed opacity-40'
          : checked
          ? 'cursor-pointer bg-orange-50'
          : 'cursor-pointer hover:bg-slate-50'
      }`}
    >
      <span
        className={`relative flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors ${
          checked ? 'border-orange-500 bg-orange-500' : 'border-slate-300 bg-white'
        }`}
      >
        {checked && (
          <svg viewBox="0 0 10 8" fill="none" className="h-2.5 w-2.5" aria-hidden>
            <path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        <input
          id={id}
          type="checkbox"
          className="absolute inset-0 opacity-0"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
      </span>
      <span
        className={`flex-1 truncate text-sm leading-none ${
          checked ? 'font-medium text-slate-900' : 'text-slate-700'
        }`}
      >
        {label}
      </span>
      {count !== undefined && (
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
            checked ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {count}
        </span>
      )}
    </label>
  );
}

/* ─── Radio row (single-select lists like Rating) ────────────────────────── */

export function RadioRow({
  id,
  name,
  checked,
  onChange,
  children,
  count,
}: {
  id: string;
  name: string;
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <label
      htmlFor={id}
      className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors ${
        checked ? 'bg-orange-50' : 'hover:bg-slate-50'
      } cursor-pointer`}
    >
      <span
        className={`relative flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border transition-colors ${
          checked ? 'border-orange-500 bg-orange-500' : 'border-slate-300 bg-white'
        }`}
      >
        {checked && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
        <input
          id={id}
          type="radio"
          name={name}
          className="absolute inset-0 opacity-0"
          checked={checked}
          onChange={onChange}
        />
      </span>
      <span className="flex-1 text-sm leading-none text-slate-700">{children}</span>
      {count !== undefined && (
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
            checked ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {count}
        </span>
      )}
    </label>
  );
}

/* ─── Color swatch row ──────────────────────────────────────────────────── */

function looksLikeColorValue(v: string) {
  return v.startsWith('#') || v.startsWith('rgb') || v.startsWith('hsl');
}

export function ColorSwatchRow({
  id,
  value,
  checked,
  count,
  disabled,
  onChange,
}: {
  id: string;
  value: string;
  checked: boolean;
  count?: number;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  const isHex = looksLikeColorValue(value);
  return (
    <label
      htmlFor={id}
      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors ${
        disabled
          ? 'cursor-not-allowed opacity-40'
          : checked
          ? 'cursor-pointer bg-orange-50'
          : 'cursor-pointer hover:bg-slate-50'
      }`}
    >
      <span className="relative">
        <span
          className={`block h-5 w-5 flex-shrink-0 rounded-full border-2 transition-all ${
            checked ? 'border-orange-500 ring-2 ring-orange-200' : 'border-slate-300'
          }`}
          style={{ backgroundColor: isHex ? value : undefined }}
          title={value}
        >
          {!isHex && (
            <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold uppercase text-slate-600">
              {value.slice(0, 2)}
            </span>
          )}
        </span>
        <input
          id={id}
          type="checkbox"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
      </span>
      <span
        className={`flex-1 truncate text-sm leading-none ${
          checked ? 'font-medium text-slate-900' : 'text-slate-700'
        }`}
      >
        {value}
      </span>
      {count !== undefined && (
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
            checked ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {count}
        </span>
      )}
    </label>
  );
}

/* ─── Star rating display (read-only) ───────────────────────────────────── */

export function StarRow({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          viewBox="0 0 20 20"
          fill={i <= value ? '#F59E0B' : '#E2E8F0'}
          className="h-3.5 w-3.5"
          aria-hidden
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.714 5.278a1 1 0 00.95.69h5.548c.969 0 1.371 1.24.588 1.81l-4.486 3.26a1 1 0 00-.364 1.118l1.714 5.278c.3.922-.755 1.688-1.54 1.118l-4.486-3.26a1 1 0 00-1.176 0l-4.486 3.26c-.784.57-1.838-.196-1.539-1.118l1.714-5.278a1 1 0 00-.364-1.118L2.253 9.705c-.783-.57-.38-1.81.588-1.81h5.548a1 1 0 00.95-.69l1.714-5.278z" />
        </svg>
      ))}
    </span>
  );
}
