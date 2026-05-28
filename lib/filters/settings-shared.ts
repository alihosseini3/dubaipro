/** Shared types and defaults — safe to import from client components. */

export type FilterVisibilityKey =
  | 'showPriceFilter'
  | 'showBrandFilter'
  | 'showSupplierFilter'
  | 'showInStockFilter'
  | 'showB2BFilter'
  | 'showRatingFilter'
  | 'showDiscountFilter'
  | 'showNewArrivalsFilter'
  | 'showSearchFilter';

export const FILTER_VISIBILITY_KEYS: readonly FilterVisibilityKey[] = [
  'showPriceFilter',
  'showBrandFilter',
  'showSupplierFilter',
  'showInStockFilter',
  'showB2BFilter',
  'showRatingFilter',
  'showDiscountFilter',
  'showNewArrivalsFilter',
  'showSearchFilter',
];

export type FilterSettingsDTO = Record<FilterVisibilityKey, boolean> & {
  maxBrandsVisible: number;
  maxSuppliersVisible: number;
  priceSliderStep: number;
  priceLabel: string;
  brandLabel: string;
  supplierLabel: string;
  availabilityLabel: string;
  ratingLabel: string;
  discountLabel: string;
  newArrivalsLabel: string;
  searchLabel: string;
};

export const DEFAULT_FILTER_SETTINGS: FilterSettingsDTO = {
  showPriceFilter: true,
  showBrandFilter: true,
  showSupplierFilter: true,
  showInStockFilter: true,
  showB2BFilter: true,
  showRatingFilter: true,
  showDiscountFilter: true,
  showNewArrivalsFilter: true,
  showSearchFilter: true,
  maxBrandsVisible: 8,
  maxSuppliersVisible: 8,
  priceSliderStep: 10,
  priceLabel: 'Price Range',
  brandLabel: 'Brand',
  supplierLabel: 'Supplier',
  availabilityLabel: 'Availability',
  ratingLabel: 'Rating',
  discountLabel: 'Deals',
  newArrivalsLabel: 'New Arrivals',
  searchLabel: 'Search products',
};
