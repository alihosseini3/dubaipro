'use client';

import { useState } from 'react';
import type { AdvancedFilters } from './types';

const Ic = ({ d, className = 'h-4 w-4' }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d={d} />
  </svg>
);

type Props = {
  filters:   AdvancedFilters;
  mimeFilter: string;
  isActive:  boolean;
  onChange(patch: Partial<AdvancedFilters>): void;
  onMimeChange(mime: string): void;
  onClear(): void;
  onClose(): void;
};

const BOOL_FILTERS: { key: keyof AdvancedFilters; label: string; icon: string; color: string }[] = [
  { key: 'noAlt',      label: 'Missing ALT text',      icon: 'M17.5 17.5L22 22M16 11a5 5 0 1 1-10 0 5 5 0 0 1 10 0z', color: 'amber' },
  { key: 'noWebP',     label: 'No WebP variant',        icon: 'M4 16l4-4 4 4 4-8 4 8M3 3h18v14H3z',                    color: 'orange' },
  { key: 'noAvif',     label: 'No AVIF variant',        icon: 'M4 16l4-4 4 4 4-8 4 8M3 3h18v14H3z',                    color: 'red'    },
  { key: 'unused',     label: 'Unused (no references)', icon: 'M18.364 5.636L5.636 18.364M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z', color: 'slate' },
  { key: 'duplicates', label: 'Duplicate files',        icon: 'M8 17.9H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2M10 8h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z', color: 'violet' },
];

const COLOR_CLASSES: Record<string, string> = {
  amber:  'bg-amber-50  border-amber-300  text-amber-700',
  orange: 'bg-orange-50 border-orange-300 text-orange-700',
  red:    'bg-red-50    border-red-300    text-red-700',
  slate:  'bg-slate-50  border-slate-300  text-slate-700',
  violet: 'bg-violet-50 border-violet-300 text-violet-700',
};

const COLOR_ACTIVE: Record<string, string> = {
  amber:  'bg-amber-100  border-amber-400  text-amber-800',
  orange: 'bg-orange-100 border-orange-400 text-orange-800',
  red:    'bg-red-100    border-red-400    text-red-800',
  slate:  'bg-slate-200  border-slate-400  text-slate-800',
  violet: 'bg-violet-100 border-violet-400 text-violet-800',
};

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export function AdvancedFilters({ filters, mimeFilter, isActive, onChange, onMimeChange, onClear, onClose }: Props) {
  const [sizePreset, setSizePreset] = useState('');
  const [scorePreset, setScorePreset] = useState('');

  const handleSizePreset = (val: string) => {
    setSizePreset(val);
    if (val === 'small')   { onChange({ minSize: undefined, maxSize: 100 * 1024 }); return; }
    if (val === 'medium')  { onChange({ minSize: 100 * 1024, maxSize: 500 * 1024 }); return; }
    if (val === 'large')   { onChange({ minSize: 500 * 1024, maxSize: undefined }); return; }
    if (val === 'oversized') { onChange({ minSize: 200 * 1024, maxSize: undefined }); return; }
    onChange({ minSize: undefined, maxSize: undefined });
  };

  const handleScorePreset = (val: string) => {
    setScorePreset(val);
    if (val === 'low')    { onChange({ minScore: undefined, maxScore: 59 }); return; }
    if (val === 'medium') { onChange({ minScore: 60, maxScore: 79 }); return; }
    if (val === 'high')   { onChange({ minScore: 80, maxScore: undefined }); return; }
    onChange({ minScore: undefined, maxScore: undefined });
  };

  const activeCount = Object.values(filters).filter(Boolean).length + (mimeFilter ? 1 : 0);

  return (
    <div className="absolute end-0 top-full z-40 mt-1.5 w-80 rounded-2xl border border-slate-200 bg-white shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <Ic d="M3 6h18M7 12h10M11 18h2" className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-800">Advanced Filters</span>
          {activeCount > 0 && (
            <span className="rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {activeCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isActive && (
            <button type="button" onClick={onClear}
              className="rounded-lg px-2 py-1 text-[11px] font-semibold text-orange-600 hover:bg-orange-50">
              Clear all
            </button>
          )}
          <button type="button" onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <Ic d="M18 6L6 18M6 6l12 12" className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="max-h-[70vh] overflow-y-auto px-4 py-3 space-y-4">
        {/* Boolean filters */}
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Conditions</p>
          <div className="space-y-1.5">
            {BOOL_FILTERS.map(({ key, label, icon, color }) => {
              const active = !!filters[key as keyof AdvancedFilters];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onChange({ [key]: active ? undefined : true })}
                  className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-sm font-medium transition
                    ${active ? COLOR_ACTIVE[color] : COLOR_CLASSES[color]} hover:opacity-90`}
                >
                  <Ic d={icon} className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 text-start text-xs">{label}</span>
                  {active && <Ic d="M20 6L9 17l-5-5" className="h-3 w-3 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* MIME type */}
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">File type</p>
          <div className="flex gap-1.5 flex-wrap">
            {[['', 'All'], ['image/', 'Images'], ['video/', 'Videos']].map(([val, label]) => (
              <button key={val} type="button" onClick={() => onMimeChange(val)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition
                  ${mimeFilter === val ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* File size */}
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">File size</p>
          <div className="flex gap-1.5 flex-wrap">
            {[['', 'Any'], ['small', '<100 KB'], ['medium', '100–500 KB'], ['large', '>500 KB'], ['oversized', '>200 KB (oversized)']].map(([val, label]) => (
              <button key={val} type="button" onClick={() => handleSizePreset(val)}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition
                  ${sizePreset === val ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                {label}
              </button>
            ))}
          </div>
          {(filters.minSize !== undefined || filters.maxSize !== undefined) && (
            <p className="mt-1 text-[10px] text-slate-400">
              {filters.minSize !== undefined ? `Min: ${fmtBytes(filters.minSize)}` : ''}
              {filters.minSize !== undefined && filters.maxSize !== undefined ? ' — ' : ''}
              {filters.maxSize !== undefined ? `Max: ${fmtBytes(filters.maxSize)}` : ''}
            </p>
          )}
        </div>

        {/* Dimensions */}
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Dimensions (px)</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Min width',  key: 'minWidth' },
              { label: 'Max width',  key: 'maxWidth' },
              { label: 'Min height', key: 'minHeight' },
              { label: 'Max height', key: 'maxHeight' },
            ].map(({ label, key }) => (
              <label key={key} className="block">
                <span className="block text-[10px] text-slate-400 mb-0.5">{label}</span>
                <input
                  type="number" min={0}
                  value={(filters as Record<string, unknown>)[key] as number ?? ''}
                  onChange={(e) => onChange({ [key]: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                  placeholder="—"
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-orange-400"
                />
              </label>
            ))}
          </div>
        </div>

        {/* SEO Score */}
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">SEO score</p>
          <div className="flex gap-1.5">
            {[['', 'Any'], ['low', 'Low (<60)'], ['medium', '60-79'], ['high', 'High (≥80)']].map(([val, label]) => (
              <button key={val} type="button" onClick={() => handleScorePreset(val)}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition
                  ${scorePreset === val
                    ? val === 'low'    ? 'border-red-400 bg-red-50 text-red-700'
                    : val === 'medium' ? 'border-amber-400 bg-amber-50 text-amber-700'
                    : val === 'high'   ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                    : 'border-orange-400 bg-orange-50 text-orange-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Processing status */}
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Processing status</p>
          <div className="flex gap-1.5 flex-wrap">
            {[['', 'Any'], ['done', 'Done'], ['pending', 'Pending'], ['failed', 'Failed']].map(([val, label]) => (
              <button key={val} type="button" onClick={() => onChange({ processingStatus: val || undefined })}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition
                  ${(filters.processingStatus ?? '') === val ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
