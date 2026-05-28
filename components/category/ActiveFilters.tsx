'use client';

import { useLocale, useTranslations } from 'next-intl';

import type {
  AttributeFacet,
  CategoryFilterState,
  FilterFacets,
} from '@/lib/categories/filter';

/**
 * Active-filter pill strip. Every filter currently applied (price, brand,
 * attribute value, rating, deals, new arrivals, search query…) is rendered
 * as a removable chip so users always see — and can undo — their selection.
 *
 * Key design notes:
 *   1. Every chip links back to a concrete `onClear(family, value?)` call
 *      so there's no ambiguity about what a click does.
 *   2. Attribute chips use a synthetic `attr:<slug>` family key to keep
 *      `CategoryFilterState` the single typed source of truth.
 *   3. Localisation: we accept a `locale`/`t` context and resolve
 *      attribute names through `nameTranslations` the same way the
 *      panel does, so both always agree.
 */
type ClearFamily = keyof CategoryFilterState | `attr:${string}`;

type Props = {
  filters: CategoryFilterState;
  facets: FilterFacets;
  onClear: (key: ClearFamily, value?: string) => void;
  onClearAll: () => void;
};

type Chip = {
  key: string;
  label: string;
  onRemove: () => void;
};

function FilterChip({ label, onRemove, removeAria }: { label: string; onRemove: () => void; removeAria: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 py-1 pl-3 pr-1.5 text-xs font-medium text-orange-800">
      <span className="truncate max-w-[180px]">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeAria}
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-orange-500 transition-colors hover:bg-orange-200 hover:text-orange-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3" aria-hidden>
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </span>
  );
}

function resolveAttrName(attr: AttributeFacet, locale: string): string {
  if (attr.nameTranslations) {
    return attr.nameTranslations[locale] ?? attr.nameTranslations['en'] ?? attr.name;
  }
  return attr.name;
}

export function ActiveFilters({ filters, facets, onClear, onClearAll }: Props) {
  const t = useTranslations('filters');
  const locale = useLocale();
  const chips: Chip[] = [];

  if (filters.q) {
    chips.push({
      key: `q:${filters.q}`,
      label: `"${filters.q}"`,
      onRemove: () => onClear('q'),
    });
  }

  if (filters.minPrice !== undefined) {
    chips.push({
      key: 'minPrice',
      label: `${t('from')} ${t('currency')} ${filters.minPrice.toLocaleString()}`,
      onRemove: () => onClear('minPrice'),
    });
  }
  if (filters.maxPrice !== undefined) {
    chips.push({
      key: 'maxPrice',
      label: `${t('to')} ${t('currency')} ${filters.maxPrice.toLocaleString()}`,
      onRemove: () => onClear('maxPrice'),
    });
  }

  for (const id of filters.brandIds) {
    const brand = facets.brands.find((b) => b.id === id);
    if (brand) {
      chips.push({
        key: `b:${id}`,
        label: brand.name,
        onRemove: () => onClear('brandIds', id),
      });
    }
  }

  for (const id of filters.supplierIds) {
    const supplier = facets.suppliers.find((s) => s.id === id);
    if (supplier) {
      chips.push({
        key: `s:${id}`,
        label: supplier.name,
        onRemove: () => onClear('supplierIds', id),
      });
    }
  }

  if (filters.inStock) {
    chips.push({ key: 'inStock', label: t('inStock'), onRemove: () => onClear('inStock') });
  }
  if (filters.isB2B) {
    chips.push({ key: 'isB2B', label: t('b2bOnly'), onRemove: () => onClear('isB2B') });
  }
  if (filters.rating) {
    chips.push({
      key: 'rating',
      label: t('ratingChip', { value: filters.rating }),
      onRemove: () => onClear('rating'),
    });
  }
  if (filters.hasDiscount) {
    chips.push({ key: 'discount', label: t('dealsOnly'), onRemove: () => onClear('hasDiscount') });
  }
  if (filters.newArrivals) {
    chips.push({ key: 'new', label: t('newOnly'), onRemove: () => onClear('newArrivals') });
  }

  // Attribute value chips — one per (slug, value) pair so each can be
  // dropped independently. The label is "<attrName>: <value>" which
  // reads naturally across LTR and RTL scripts.
  for (const [slug, vals] of Object.entries(filters.attrs ?? {})) {
    const attr = facets.attributes.find((a) => a.slug === slug);
    const attrName = attr ? resolveAttrName(attr, locale) : slug;
    for (const v of vals) {
      chips.push({
        key: `a:${slug}:${v}`,
        label: `${attrName}: ${v}`,
        onRemove: () => onClear(`attr:${slug}`, v),
      });
    }
  }

  if (chips.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2" aria-live="polite">
      {chips.map((chip) => (
        <FilterChip
          key={chip.key}
          label={chip.label}
          onRemove={chip.onRemove}
          removeAria={`${t('removeFilter')}: ${chip.label}`}
        />
      ))}
      {chips.length > 1 && (
        <button
          type="button"
          onClick={onClearAll}
          className="text-xs font-medium text-slate-500 underline-offset-2 transition-colors hover:text-slate-900 hover:underline"
        >
          {t('clearAll')}
        </button>
      )}
    </div>
  );
}
