'use client';

import { useCallback, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';

import { FilterPanel } from './FilterPanel';
import { ActiveFilters } from './ActiveFilters';
import { SortBar } from './SortBar';
import { ProductCardPro } from './ProductCardPro';
import { GridSkeletons } from './GridSkeletons';
import type { FilteredProduct, FilterFacets, CategoryFilterState } from '@/lib/categories/filter';
import type { CategoryNode } from '@/lib/categories/service';
import type { FilterSettingsDTO } from '@/lib/filters/settings-shared';

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type Props = {
  category: CategoryNode;
  products: FilteredProduct[];
  facets: FilterFacets;
  filters: CategoryFilterState;
  pagination: Pagination;
  locale: string;
  isAuthenticated: boolean;
  wishlistIds: string[];
  filterSettings?: FilterSettingsDTO;
};

export function CategoryClientShell({
  products,
  facets,
  filters,
  pagination,
  locale,
  isAuthenticated,
  wishlistIds,
  filterSettings,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const wishlistSet = new Set(wishlistIds);

  const applyFilters = useCallback(
    (updates: Partial<CategoryFilterState>) => {
      const next: CategoryFilterState = { ...filters, ...updates };

      const params = new URLSearchParams();

      if (next.sort && next.sort !== 'newest') params.set('sort', next.sort);
      if (next.q) params.set('q', next.q);
      if (next.minPrice !== undefined && next.minPrice !== facets.priceRange.min)
        params.set('minPrice', String(next.minPrice));
      if (next.maxPrice !== undefined && next.maxPrice !== facets.priceRange.max)
        params.set('maxPrice', String(next.maxPrice));
      if (next.brandIds.length) params.set('brands', next.brandIds.join(','));
      if (next.supplierIds.length) params.set('suppliers', next.supplierIds.join(','));
      if (next.inStock) params.set('inStock', 'true');
      if (next.isB2B) params.set('isB2B', 'true');
      if (next.rating) params.set('rating', String(next.rating));
      if (next.hasDiscount) params.set('discount', 'true');
      if (next.newArrivals) params.set('new', 'true');
      if (next.page > 1) params.set('page', String(next.page));
      // Attribute filters ride on `attr_<slug>` so Googlebot can still
      // surface distinct URLs and users can deep-link a refinement.
      for (const [slug, vals] of Object.entries(next.attrs ?? {})) {
        if (vals.length > 0) params.set(`attr_${slug}`, vals.join(','));
      }

      const qs = params.toString();
      startTransition(() => {
        router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
      });
    },
    [filters, pathname, router, facets.priceRange]
  );

  /**
   * Remove a single chip from the active-filters strip.
   *
   * `key` identifies the filter family, `value` pinpoints the specific
   * item to drop when the family is multi-valued (brand ids, attr values).
   * Unknown keys are a no-op so the chip renderer stays future-proof.
   */
  const clearFilter = (key: keyof CategoryFilterState | `attr:${string}`, value?: string) => {
    // Attribute filters use a synthetic `attr:<slug>` family so a single
    // chip click can drop one value out of (potentially) many.
    if (typeof key === 'string' && key.startsWith('attr:')) {
      const slug = key.slice(5);
      const current = filters.attrs?.[slug] ?? [];
      const next = value ? current.filter((v) => v !== value) : [];
      const attrs = { ...(filters.attrs ?? {}) };
      if (next.length > 0) attrs[slug] = next;
      else delete attrs[slug];
      applyFilters({ attrs, page: 1 });
      return;
    }

    switch (key) {
      case 'brandIds':
        applyFilters({
          brandIds: value ? filters.brandIds.filter((id) => id !== value) : [],
          page: 1,
        });
        break;
      case 'supplierIds':
        applyFilters({
          supplierIds: value
            ? filters.supplierIds.filter((id) => id !== value)
            : [],
          page: 1,
        });
        break;
      case 'minPrice':
        applyFilters({ minPrice: undefined, page: 1 });
        break;
      case 'maxPrice':
        applyFilters({ maxPrice: undefined, page: 1 });
        break;
      case 'inStock':
        applyFilters({ inStock: false, page: 1 });
        break;
      case 'isB2B':
        applyFilters({ isB2B: false, page: 1 });
        break;
      case 'rating':
        applyFilters({ rating: undefined, page: 1 });
        break;
      case 'hasDiscount':
        applyFilters({ hasDiscount: false, page: 1 });
        break;
      case 'newArrivals':
        applyFilters({ newArrivals: false, page: 1 });
        break;
      case 'q':
        applyFilters({ q: undefined, page: 1 });
        break;
    }
  };

  const clearAll = () =>
    applyFilters({
      sort: 'newest',
      q: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      brandIds: [],
      supplierIds: [],
      inStock: false,
      isB2B: false,
      rating: undefined,
      hasDiscount: false,
      newArrivals: false,
      attrs: {},
      page: 1,
    });

  return (
    <div className="grid grid-cols-12 items-start gap-6">
      {/* ── Desktop filter sidebar ──────────────────────────────────── */}
      <aside className="hidden lg:col-span-3 lg:block">
        <div className="sticky top-20">
          <FilterPanel facets={facets} filters={filters} onApply={applyFilters} settings={filterSettings} />
        </div>
      </aside>

      {/* ── Main content column ─────────────────────────────────────── */}
      <div className="col-span-12 min-w-0 lg:col-span-9">
        {/* Sort bar (also contains mobile filter drawer trigger) */}
        <SortBar
          total={pagination.total}
          sort={filters.sort}
          onSortChange={(sort) => applyFilters({ sort, page: 1 })}
          facets={facets}
          filters={filters}
          onApply={applyFilters}
          filterSettings={filterSettings}
        />

        {/* Active filter chips */}
        <ActiveFilters
          filters={filters}
          facets={facets}
          onClear={clearFilter}
          onClearAll={clearAll}
        />

        {/* Loading skeletons */}
        {isPending ? (
          <GridSkeletons count={pagination.pageSize} />
        ) : products.length === 0 ? (
          /* ── Empty state ───────────────────────────────────────────── */
          <div className="mt-6 flex min-h-[50vh] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-gradient-to-b from-slate-50 to-white px-8 py-14 text-center">
            {/* Illustration */}
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100 shadow-inner">
              <svg
                viewBox="0 0 64 64"
                className="h-10 w-10 text-slate-400"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <circle cx="28" cy="28" r="18" />
                <path d="M41 41l13 13" />
                <path d="M22 28h12M28 22v12" />
              </svg>
            </div>

            <h3 className="text-lg font-bold text-slate-800">No products found</h3>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-500">
              No products match your current filters. Try removing some or clearing all.
            </p>

            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={clearAll}
                className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 hover:shadow-md active:scale-[0.98]"
              >
                Clear all filters
              </button>
            </div>
          </div>
        ) : (
          /* ── Product grid ──────────────────────────────────────────── */
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {products.map((product) => (
              <ProductCardPro
                key={product.id}
                product={product}
                locale={locale}
                isAuthenticated={isAuthenticated}
                inWishlist={wishlistSet.has(product.id)}
              />
            ))}
          </div>
        )}

        {/* ── Pagination ─────────────────────────────────────────────── */}
        {!isPending && pagination.totalPages > 1 && (
          <nav
            className="mt-10 flex items-center justify-center gap-1"
            aria-label="Pagination"
          >
            {/* Previous */}
            <button
              disabled={filters.page <= 1}
              onClick={() => applyFilters({ page: filters.page - 1 })}
              className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
                <path
                  fillRule="evenodd"
                  d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              Prev
            </button>

            {/* Page numbers */}
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
              .filter(
                (p) =>
                  p === 1 ||
                  p === pagination.totalPages ||
                  Math.abs(p - filters.page) <= 2
              )
              .reduce<(number | '…')[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('…');
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === '…' ? (
                  <span key={`ellipsis-${i}`} className="px-2 text-slate-400">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => applyFilters({ page: p as number })}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-medium transition-colors ${
                      filters.page === p
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {p}
                  </button>
                )
              )}

            {/* Next */}
            <button
              disabled={filters.page >= pagination.totalPages}
              onClick={() => applyFilters({ page: filters.page + 1 })}
              className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
