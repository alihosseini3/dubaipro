'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FilterPanel } from './FilterPanel';
import type { FilterFacets, CategoryFilterState } from '@/lib/categories/filter';
import type { FilterSettingsDTO } from '@/lib/filters/settings-shared';

type Props = {
  open: boolean;
  onClose: () => void;
  facets: FilterFacets;
  filters: CategoryFilterState;
  onApply: (updates: Partial<CategoryFilterState>) => void;
  activeCount: number;
  filterSettings?: FilterSettingsDTO;
};

export function FilterDrawer({
  open,
  onClose,
  facets,
  filters,
  onApply,
  activeCount,
  filterSettings,
}: Props) {
  const t = useTranslations('filters');
  const [rendered, setRendered] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setRendered(true);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => setVisible(true))
      );
    } else {
      setVisible(false);
      const timer = setTimeout(() => setRendered(false), 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!rendered) return null;

  return (
    <div
      className={`fixed inset-0 z-50 lg:hidden transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      role="dialog"
      aria-modal
      aria-label={t('title')}
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`absolute inset-y-0 start-0 flex w-full max-w-xs flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out ${
          visible ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
          <span className="flex items-center gap-2 text-base font-bold text-slate-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500 text-white">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path
                  fillRule="evenodd"
                  d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L13 10.414V15a1 1 0 01-.553.894l-4 2A1 1 0 017 17v-6.586L3.293 6.707A1 1 0 013 6V3z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
            {t('title')}
            {activeCount > 0 && (
              <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-orange-500 px-1.5 text-[10px] font-bold text-white">
                {activeCount}
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('hideFilters')}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Scrollable filter content */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          <FilterPanel facets={facets} filters={filters} onApply={onApply} settings={filterSettings} />
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-4 py-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-orange-500 py-3 text-sm font-bold text-white transition-colors hover:bg-orange-600 active:scale-[0.98]"
          >
            {t('applyFilters')}
            {activeCount > 0 && (
              <span className="ml-2 rounded-full bg-white/25 px-2 py-0.5 text-xs">
                {activeCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
