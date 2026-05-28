'use client';

import { useMemo, useState } from 'react';

import { CheckboxRow, Ico, ICONS } from './adapters';

type FacetItem = { id: string; name: string; count: number };

/**
 * Searchable, "show more" list used for brand / supplier / attr select
 * facets. Everything heavier than a handful of rows gets a search box
 * and a collapsed preview — the two patterns shoppers recognise from
 * Amazon and Farfetch.
 */
export function FacetList({
  items,
  maxVisible,
  selectedIds,
  onToggle,
  searchLabel,
  showMoreLabel,
  showLessLabel,
}: {
  items: FacetItem[];
  maxVisible: number;
  selectedIds: string[];
  onToggle: (id: string, checked: boolean) => void;
  searchLabel: string;
  showMoreLabel: string;
  showLessLabel: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');

  // Filter + sort: selected rows always float to the top so they stay
  // visible under heavy scrolling; same-state rows keep their incoming
  // order (which is server-side alphabetical).
  const ordered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const hits = needle ? items.filter((i) => i.name.toLowerCase().includes(needle)) : items;
    const selectedSet = new Set(selectedIds);
    return [...hits].sort((a, b) => {
      const aSel = selectedSet.has(a.id);
      const bSel = selectedSet.has(b.id);
      if (aSel !== bSel) return aSel ? -1 : 1;
      return 0;
    });
  }, [items, query, selectedIds]);

  const effectiveMax = maxVisible > 0 ? maxVisible : ordered.length;
  const visible = expanded ? ordered : ordered.slice(0, effectiveMax);
  const hiddenCount = ordered.length - visible.length;

  return (
    <div className="space-y-0.5">
      {items.length > effectiveMax && (
        <div className="relative mb-2">
          <Ico d={ICONS.search} cls="absolute start-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder={searchLabel}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setExpanded(true);
            }}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 ps-7 pe-3 text-xs text-slate-700 placeholder:text-slate-400 focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
          />
        </div>
      )}

      {visible.length === 0 ? (
        <p className="py-2 text-center text-[11px] text-slate-400">—</p>
      ) : (
        visible.map((item) => (
          <CheckboxRow
            key={item.id}
            id={`facet-${item.id}`}
            label={item.name}
            count={item.count}
            checked={selectedIds.includes(item.id)}
            disabled={item.count === 0 && !selectedIds.includes(item.id)}
            onChange={(v) => onToggle(item.id, v)}
          />
        ))
      )}

      {!expanded && hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-1 w-full rounded-lg border border-dashed border-slate-200 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:border-orange-200 hover:text-orange-600"
        >
          + {hiddenCount} {showMoreLabel}
        </button>
      )}
      {expanded && ordered.length > effectiveMax && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mt-1 w-full rounded-lg border border-dashed border-slate-200 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:border-orange-200 hover:text-orange-600"
        >
          {showLessLabel}
        </button>
      )}
    </div>
  );
}
