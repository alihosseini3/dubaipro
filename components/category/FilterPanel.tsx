'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import type {
  AttributeFacet,
  CategoryFilterState,
  FilterFacets,
} from '@/lib/categories/filter';
import { DEFAULT_FILTER_SETTINGS, type FilterSettingsDTO } from '@/lib/filters/settings-shared';

import { AttributeFacetView } from './filters/AttributeFacetView';
import { FacetList } from './filters/FacetList';
import { RangeSlider } from './filters/RangeSlider';
import { Ico, ICONS, RadioRow, Section, StarRow } from './filters/adapters';

type Props = {
  facets: FilterFacets;
  filters: CategoryFilterState;
  onApply: (updates: Partial<CategoryFilterState>) => void;
  settings?: FilterSettingsDTO;
};

/* ────────────────────────────────────────────────────────────────────────── *
 * FilterPanel
 *
 * Composition-oriented filter sidebar. Every section is a conditional
 * render driven by `settings.show*` flags (the admin-controlled global
 * visibility + per-category overrides), keeping the template declarative
 * and letting the adapters in `./filters/*` handle the heavy lifting.
 *
 * Active-count logic lives here so both desktop + drawer surface the
 * same badge number consistently.
 * ────────────────────────────────────────────────────────────────────────── */

function resolveAttrName(attr: AttributeFacet, locale: string): string {
  if (attr.nameTranslations) {
    return attr.nameTranslations[locale] ?? attr.nameTranslations['en'] ?? attr.name;
  }
  return attr.name;
}

function countActive(filters: CategoryFilterState): number {
  const attrCount = Object.values(filters.attrs ?? {}).reduce((n, v) => n + v.length, 0);
  return (
    (filters.q ? 1 : 0) +
    (filters.minPrice !== undefined || filters.maxPrice !== undefined ? 1 : 0) +
    filters.brandIds.length +
    filters.supplierIds.length +
    (filters.inStock ? 1 : 0) +
    (filters.isB2B ? 1 : 0) +
    (filters.rating ? 1 : 0) +
    (filters.hasDiscount ? 1 : 0) +
    (filters.newArrivals ? 1 : 0) +
    attrCount
  );
}

/* ─── Inline search box (committed on submit / blur) ─────────────────────── */

function SearchBox({
  value,
  onCommit,
  placeholder,
}: {
  value: string | undefined;
  onCommit: (q: string | undefined) => void;
  placeholder: string;
}) {
  const [local, setLocal] = useState(value ?? '');
  const lastExternal = useRef(value ?? '');
  useEffect(() => {
    if ((value ?? '') !== lastExternal.current) {
      lastExternal.current = value ?? '';
      setLocal(value ?? '');
    }
  }, [value]);

  const submit = () => {
    const trimmed = local.trim();
    onCommit(trimmed.length >= 2 ? trimmed : undefined);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="relative"
    >
      <Ico d={ICONS.search} cls="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={submit}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 ps-8 pe-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
      />
    </form>
  );
}

/* ─── Main ──────────────────────────────────────────────────────────────── */

export function FilterPanel({ facets, filters, onApply, settings }: Props) {
  const t = useTranslations('filters');
  const locale = useLocale();
  const cfg = settings ?? DEFAULT_FILTER_SETTINGS;

  const hasPriceRange = facets.priceRange.max > facets.priceRange.min;
  const activeCount = countActive(filters);
  const hasActiveFilters = activeCount > 0;

  const toggleBrand = (id: string, checked: boolean) =>
    onApply({
      brandIds: checked ? [...filters.brandIds, id] : filters.brandIds.filter((b) => b !== id),
      page: 1,
    });

  const toggleSupplier = (id: string, checked: boolean) =>
    onApply({
      supplierIds: checked
        ? [...filters.supplierIds, id]
        : filters.supplierIds.filter((s) => s !== id),
      page: 1,
    });

  const toggleAttr = (slug: string, value: string, checked: boolean) => {
    const current = filters.attrs?.[slug] ?? [];
    const next = checked ? [...current, value] : current.filter((v) => v !== value);
    const attrs = { ...(filters.attrs ?? {}) };
    if (next.length > 0) attrs[slug] = next;
    else delete attrs[slug];
    onApply({ attrs, page: 1 });
  };

  const commitRange = (slug: string, range: [number, number] | null) => {
    // Number-typed attrs are persisted as the two endpoint values — the
    // URL stays parseable by the same `attr_<slug>` parser.
    if (range) {
      const attrs = { ...(filters.attrs ?? {}), [slug]: [String(range[0]), String(range[1])] };
      onApply({ attrs, page: 1 });
    } else {
      const attrs = { ...(filters.attrs ?? {}) };
      delete attrs[slug];
      onApply({ attrs, page: 1 });
    }
  };

  const handleClearAll = () =>
    onApply({
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

  const priceValue: [number, number] = [
    filters.minPrice ?? facets.priceRange.min,
    filters.maxPrice ?? facets.priceRange.max,
  ];

  return (
    <div
      className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"
      role="region"
      aria-label={t('title')}
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between bg-gradient-to-r from-slate-50 to-white px-4 py-3.5">
        <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500 text-white shadow-sm">
            <Ico d={ICONS.filter} cls="h-3.5 w-3.5" />
          </span>
          {t('title')}
          {activeCount > 0 && (
            <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-orange-500 px-1.5 text-[11px] font-bold text-white">
              {activeCount}
            </span>
          )}
        </span>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClearAll}
            className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            <Ico d={ICONS.close} cls="h-3 w-3" />
            {t('clearAll')}
          </button>
        )}
      </div>

      <div className="divide-y divide-slate-100 px-4">
        {/* ── Search (text query) ──────────────────────────────── */}
        {cfg.showSearchFilter && (
          <Section title={cfg.searchLabel} iconPath={ICONS.search} defaultOpen={Boolean(filters.q)}>
            <SearchBox
              value={filters.q}
              onCommit={(q) => onApply({ q, page: 1 })}
              placeholder={cfg.searchLabel}
            />
          </Section>
        )}

        {/* ── Price ────────────────────────────────────────────── */}
        {cfg.showPriceFilter && hasPriceRange && (
          <Section
            title={cfg.priceLabel}
            iconPath={ICONS.price}
            defaultOpen={filters.minPrice !== undefined || filters.maxPrice !== undefined}
            badge={filters.minPrice !== undefined || filters.maxPrice !== undefined ? 1 : 0}
          >
            <RangeSlider
              min={facets.priceRange.min}
              max={facets.priceRange.max}
              step={Math.max(1, cfg.priceSliderStep)}
              value={priceValue}
              unit={t('currency')}
              minAriaLabel={t('from')}
              maxAriaLabel={t('to')}
              applyLabel={t('applyFilters')}
              onCommit={([lo, hi]) => {
                onApply({
                  minPrice: lo > facets.priceRange.min ? lo : undefined,
                  maxPrice: hi < facets.priceRange.max ? hi : undefined,
                  page: 1,
                });
              }}
            />
          </Section>
        )}

        {/* ── Rating ───────────────────────────────────────────── */}
        {cfg.showRatingFilter && facets.ratings.some((r) => r.count > 0) && (
          <Section
            title={cfg.ratingLabel}
            iconPath={ICONS.star}
            defaultOpen={Boolean(filters.rating)}
            badge={filters.rating ? 1 : 0}
          >
            <div className="space-y-0.5">
              {facets.ratings
                .filter((r) => r.count > 0 || filters.rating === r.value)
                .map(({ value, count }) => (
                  <RadioRow
                    key={value}
                    id={`rating-${value}`}
                    name="rating"
                    checked={filters.rating === value}
                    onChange={() =>
                      onApply({ rating: filters.rating === value ? undefined : value, page: 1 })
                    }
                    count={count}
                  >
                    <span className="flex items-center gap-2">
                      <StarRow value={value} />
                      <span className="text-[11px] text-slate-500">
                        {t('ratingOption', { value })}
                      </span>
                    </span>
                  </RadioRow>
                ))}
            </div>
          </Section>
        )}

        {/* ── Availability (In-Stock / B2B / Deals / New) ───────── */}
        {(cfg.showInStockFilter ||
          cfg.showB2BFilter ||
          cfg.showDiscountFilter ||
          cfg.showNewArrivalsFilter) && (
          <Section
            title={cfg.availabilityLabel}
            iconPath={ICONS.avail}
            defaultOpen={
              filters.inStock ||
              filters.isB2B ||
              filters.hasDiscount ||
              filters.newArrivals
            }
          >
            <div className="space-y-0.5">
              {cfg.showInStockFilter && (
                <QuickToggle
                  id="inStock"
                  label={t('inStock')}
                  checked={filters.inStock}
                  onChange={(v) => onApply({ inStock: v, page: 1 })}
                />
              )}
              {cfg.showB2BFilter && (
                <QuickToggle
                  id="isB2B"
                  label={t('b2bOnly')}
                  checked={filters.isB2B}
                  onChange={(v) => onApply({ isB2B: v, page: 1 })}
                />
              )}
              {cfg.showDiscountFilter && facets.discountCount > 0 && (
                <QuickToggle
                  id="hasDiscount"
                  label={cfg.discountLabel}
                  count={facets.discountCount}
                  checked={filters.hasDiscount}
                  onChange={(v) => onApply({ hasDiscount: v, page: 1 })}
                />
              )}
              {cfg.showNewArrivalsFilter && facets.newArrivalsCount > 0 && (
                <QuickToggle
                  id="newArrivals"
                  label={cfg.newArrivalsLabel}
                  count={facets.newArrivalsCount}
                  checked={filters.newArrivals}
                  onChange={(v) => onApply({ newArrivals: v, page: 1 })}
                />
              )}
            </div>
          </Section>
        )}

        {/* ── Brands ───────────────────────────────────────────── */}
        {cfg.showBrandFilter && facets.brands.length > 0 && (
          <Section
            title={cfg.brandLabel}
            iconPath={ICONS.brand}
            defaultOpen={filters.brandIds.length > 0}
            badge={filters.brandIds.length}
          >
            <FacetList
              items={facets.brands}
              maxVisible={cfg.maxBrandsVisible}
              selectedIds={filters.brandIds}
              onToggle={toggleBrand}
              searchLabel={t('searchPlaceholder')}
              showMoreLabel={t('showMore')}
              showLessLabel={t('showLess')}
            />
          </Section>
        )}

        {/* ── Suppliers ────────────────────────────────────────── */}
        {cfg.showSupplierFilter && facets.suppliers.length > 0 && (
          <Section
            title={cfg.supplierLabel}
            iconPath={ICONS.supplier}
            defaultOpen={filters.supplierIds.length > 0}
            badge={filters.supplierIds.length}
          >
            <FacetList
              items={facets.suppliers}
              maxVisible={cfg.maxSuppliersVisible}
              selectedIds={filters.supplierIds}
              onToggle={toggleSupplier}
              searchLabel={t('searchPlaceholder')}
              showMoreLabel={t('showMore')}
              showLessLabel={t('showLess')}
            />
          </Section>
        )}

        {/* ── Dynamic attributes ───────────────────────────────── */}
        {(facets.attributes ?? []).map((attr: AttributeFacet) => {
          const selected = filters.attrs?.[attr.slug] ?? [];
          const attrName = resolveAttrName(attr, locale);
          const title = attr.unit && attr.type !== 'number' ? `${attrName} (${attr.unit})` : attrName;

          // Number-typed attrs pack their range into the same `attrs` map.
          // `[lo, hi]` (strings) — so we reshape it into a tuple here.
          const numberRange: [number, number] | null =
            attr.type === 'number' && selected.length === 2
              ? ([Number(selected[0]), Number(selected[1])] as [number, number])
              : null;

          return (
            <AttributeFacetView
              key={attr.id}
              attr={attr}
              title={title}
              selected={selected}
              numberRange={numberRange}
              onToggle={(value, checked) => toggleAttr(attr.slug, value, checked)}
              onRangeCommit={(range) => commitRange(attr.slug, range)}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ─── Local toggle row (styled like a pill button, not a checkbox) ────── */

function QuickToggle({
  id,
  label,
  count,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  count?: number;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm transition-colors ${
        checked ? 'bg-orange-50 text-slate-900 font-medium' : 'text-slate-700 hover:bg-slate-50'
      }`}
    >
      <span className="flex items-center gap-2.5">
        <span
          className={`relative flex h-4 w-4 items-center justify-center rounded border transition-colors ${
            checked ? 'border-orange-500 bg-orange-500' : 'border-slate-300 bg-white'
          }`}
        >
          {checked && (
            <svg viewBox="0 0 10 8" fill="none" className="h-2.5 w-2.5" aria-hidden>
              <path
                d="M1 4l3 3 5-6"
                stroke="#fff"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
        <span className="leading-none">{label}</span>
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
    </button>
  );
}
