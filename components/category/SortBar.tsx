'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { FilterDrawer } from './FilterDrawer';
import type { FilterFacets, CategoryFilterState } from '@/lib/categories/filter';
import type { FilterSettingsDTO } from '@/lib/filters/settings-shared';

type Props = {
  total: number;
  sort: CategoryFilterState['sort'];
  onSortChange: (sort: CategoryFilterState['sort']) => void;
  facets: FilterFacets;
  filters: CategoryFilterState;
  onApply: (updates: Partial<CategoryFilterState>) => void;
  filterSettings?: FilterSettingsDTO;
};

function countActiveFilters(f: CategoryFilterState): number {
  let n = 0;
  if (f.brandIds.length) n += f.brandIds.length;
  if (f.supplierIds.length) n += f.supplierIds.length;
  if (f.inStock) n++;
  if (f.isB2B) n++;
  if (f.minPrice !== undefined) n++;
  if (f.maxPrice !== undefined) n++;
  n += Object.values(f.attrs ?? {}).reduce((sum, vals) => sum + vals.length, 0);
  return n;
}

export function SortBar({
  total,
  sort,
  onSortChange,
  facets,
  filters,
  onApply,
  filterSettings,
}: Props) {
  const t = useTranslations('filters');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const activeCount = countActiveFilters(filters);

  const SORT_OPTIONS: { value: CategoryFilterState['sort']; label: string }[] = [
    { value: 'newest', label: t('sortNewest') },
    { value: 'popular', label: t('sortPopular') },
    { value: 'price_asc', label: t('sortPriceAsc') },
    { value: 'price_desc', label: t('sortPriceDesc') },
  ];

  return (
    <>
      <FilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        facets={facets}
        filters={filters}
        onApply={onApply}
        activeCount={activeCount}
        filterSettings={filterSettings}
      />

      <div className="sticky top-16 z-10 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white/90 px-4 py-3 shadow-sm backdrop-blur-md">
        {/* Left: result count + mobile filter button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-orange-300 hover:text-orange-600 lg:hidden min-h-[44px]"
            aria-label={t('showFilters')}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path
                fillRule="evenodd"
                d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L13 10.414V15a1 1 0 01-.553.894l-4 2A1 1 0 017 17v-6.586L3.293 6.707A1 1 0 013 6V3z"
                clipRule="evenodd"
              />
            </svg>
            {t('title')}
            {activeCount > 0 && (
              <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-orange-500 px-1.5 text-[10px] font-bold text-white">
                {activeCount}
              </span>
            )}
          </button>

          <p className="text-sm text-slate-500">
            <span className="font-semibold text-slate-900">
              {total.toLocaleString()}
            </span>{' '}
            {total === 1 ? 'product' : 'products'}
          </p>
        </div>

        {/* Right: sort dropdown */}
        <div className="flex items-center gap-2">
          <label htmlFor="sort-select" className="text-sm text-slate-500 hidden sm:block">
            {t('sortLabel')}:
          </label>
          <select
            id="sort-select"
            value={sort}
            onChange={(e) =>
              onSortChange(e.target.value as CategoryFilterState['sort'])
            }
            className="rounded-lg border border-slate-300 bg-white py-1.5 pl-3 pr-8 text-sm font-medium text-slate-700 shadow-sm transition-colors focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 hover:border-slate-400"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}
