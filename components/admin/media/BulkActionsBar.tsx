'use client';

import { useState } from 'react';

const Ic = ({ d, className = 'h-4 w-4' }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d={d} />
  </svg>
);

type Props = {
  selectedCount: number;
  totalVisible:  number;
  folders:       { folder: string; count: number }[];
  onSelectAll():  void;
  onClear():      void;
  onDelete():     void;
  onMove(folder: string): void;
  onTag(tags: string[]): void;
  onOptimize():   void;
  onRegenerate(): void;
};

export function BulkActionsBar({
  selectedCount, totalVisible, folders,
  onSelectAll, onClear, onDelete, onMove, onTag, onOptimize, onRegenerate,
}: Props) {
  const [moveTarget, setMoveTarget] = useState('');
  const [tagInput,   setTagInput]   = useState('');
  const [showTags,   setShowTags]   = useState(false);

  const handleMove = () => {
    if (!moveTarget) return;
    onMove(moveTarget);
    setMoveTarget('');
  };

  const handleTag = () => {
    const tags = tagInput.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
    if (!tags.length) return;
    onTag(tags);
    setTagInput(''); setShowTags(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-orange-200 bg-orange-50/80 px-4 py-2">
      {/* Count + selection controls */}
      <span className="text-sm font-semibold text-orange-700">
        {selectedCount} selected
      </span>
      <button type="button" onClick={onSelectAll}
        className="text-xs text-slate-600 hover:text-orange-600 hover:underline">
        Select all ({totalVisible})
      </button>
      <button type="button" onClick={onClear}
        className="text-xs text-slate-400 hover:text-slate-700 hover:underline">
        Deselect
      </button>

      <div className="flex-1" />

      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Move */}
          <div className="flex items-center gap-1">
            <select value={moveTarget} onChange={(e) => setMoveTarget(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white py-1.5 ps-2 pe-6 text-xs text-slate-700 outline-none focus:border-orange-400">
              <option value="">Move to…</option>
              {folders.map((f) => (
                <option key={f.folder} value={f.folder}>
                  {f.folder.charAt(0).toUpperCase() + f.folder.slice(1).replace(/-/g, ' ')}
                </option>
              ))}
            </select>
            {moveTarget && (
              <button type="button" onClick={handleMove}
                className="rounded-lg bg-[#0F172A] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800">
                Move
              </button>
            )}
          </div>

          {/* Tag */}
          {showTags ? (
            <div className="flex items-center gap-1">
              <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTag()}
                placeholder="tag1, tag2…"
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-orange-400 w-32" />
              <button type="button" onClick={handleTag}
                className="rounded-lg bg-[#0F172A] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800">
                Add
              </button>
              <button type="button" onClick={() => setShowTags(false)}
                className="text-slate-400 hover:text-slate-700">
                <Ic d="M18 6L6 18M6 6l12 12" className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setShowTags(true)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
              <Ic d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" className="h-3 w-3" />
              Tag
            </button>
          )}

          {/* Optimize */}
          <button type="button" onClick={onOptimize}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100">
            <Ic d="M13 10V3L4 14h7v7l9-11h-7z" className="h-3 w-3" />
            Optimize
          </button>

          {/* Regenerate */}
          <button type="button" onClick={onRegenerate}
            className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100">
            <Ic d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" className="h-3 w-3" />
            Regenerate
          </button>

          {/* Delete */}
          <button type="button" onClick={onDelete}
            className="flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700">
            <Ic d="M3 6h18M8 6V4h8v2M19 6v14H5V6" className="h-3 w-3" />
            Delete ({selectedCount})
          </button>
        </div>
      )}
    </div>
  );
}
