import 'server-only';

import type { FilterSettings } from '@prisma/client';
import { prisma } from '@/lib/prisma';

import {
  DEFAULT_FILTER_SETTINGS,
  FILTER_VISIBILITY_KEYS,
  type FilterSettingsDTO,
} from './settings-shared';

export type { FilterVisibilityKey, FilterSettingsDTO } from './settings-shared';
export { FILTER_VISIBILITY_KEYS, DEFAULT_FILTER_SETTINGS } from './settings-shared';

function rowToDto(row: FilterSettings): FilterSettingsDTO {
  return {
    showPriceFilter: row.showPriceFilter,
    showBrandFilter: row.showBrandFilter,
    showSupplierFilter: row.showSupplierFilter,
    showInStockFilter: row.showInStockFilter,
    showB2BFilter: row.showB2BFilter,
    showRatingFilter: row.showRatingFilter,
    showDiscountFilter: row.showDiscountFilter,
    showNewArrivalsFilter: row.showNewArrivalsFilter,
    showSearchFilter: row.showSearchFilter,
    maxBrandsVisible: row.maxBrandsVisible,
    maxSuppliersVisible: row.maxSuppliersVisible,
    priceSliderStep: row.priceSliderStep,
    priceLabel: row.priceLabel,
    brandLabel: row.brandLabel,
    supplierLabel: row.supplierLabel,
    availabilityLabel: row.availabilityLabel,
    ratingLabel: row.ratingLabel,
    discountLabel: row.discountLabel,
    newArrivalsLabel: row.newArrivalsLabel,
    searchLabel: row.searchLabel,
  };
}

export async function getFilterSettings(): Promise<FilterSettingsDTO> {
  const row = await prisma.filterSettings.findUnique({ where: { id: 'singleton' } });
  return row ? rowToDto(row) : DEFAULT_FILTER_SETTINGS;
}

export async function updateFilterSettings(
  data: Partial<FilterSettingsDTO>
): Promise<FilterSettingsDTO> {
  const row = await prisma.filterSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', ...DEFAULT_FILTER_SETTINGS, ...data },
    update: data,
  });
  return rowToDto(row);
}

/**
 * Resolve the effective filter configuration for a category by merging
 * the global `FilterSettings` with any per-category overrides stored on
 * `CategoryFilterConfig`. Per-category `null` values mean "inherit global".
 *
 * We only let categories override visibility toggles — labels and display
 * limits are always global to keep the UI consistent across the site.
 */
export async function getEffectiveFilterSettings(
  categorySlug: string
): Promise<FilterSettingsDTO> {
  const [global, category] = await Promise.all([
    getFilterSettings(),
    prisma.category
      .findUnique({
        where: { slug: categorySlug },
        select: { filterConfig: true },
      })
      .catch(() => null),
  ]);

  const override = category?.filterConfig;
  if (!override) return global;

  const merged: FilterSettingsDTO = { ...global };
  for (const key of FILTER_VISIBILITY_KEYS) {
    const val = override[key];
    if (typeof val === 'boolean') merged[key] = val;
  }
  return merged;
}
