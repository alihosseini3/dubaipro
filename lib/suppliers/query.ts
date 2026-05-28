import 'server-only';

import type {
  BusinessType,
  SupplierTier
} from '@prisma/client';

import {
  SUPPLIER_LIST_DEFAULT_PAGE_SIZE,
  SUPPLIER_LIST_MAX_PAGE_SIZE,
  type SupplierListFilters
} from './types';

const VALID_TIERS: SupplierTier[] = ['STANDARD', 'VERIFIED', 'GUARANTEED'];
const VALID_BUSINESS: BusinessType[] = [
  'MANUFACTURER',
  'TRADING_COMPANY',
  'DISTRIBUTOR',
  'WHOLESALER',
  'AGENT',
  'OTHER'
];
const VALID_SORTS: NonNullable<SupplierListFilters['sort']>[] = [
  'recent',
  'top-rated',
  'most-followed',
  'name'
];

/**
 * Strict URL-search-params parser for the supplier listing endpoint.
 *
 * Drops unknown / malformed values silently — a noisy 400 would only
 * frustrate users sharing copy-pasted URLs. Pagination clamps to safe
 * bounds so attackers cannot ask for `pageSize=1_000_000`.
 */
export function parseSupplierListQuery(
  searchParams: URLSearchParams
): SupplierListFilters {
  const out: SupplierListFilters = {};

  const search = searchParams.get('q')?.trim();
  if (search) out.search = search.slice(0, 120);

  const country = searchParams.get('country')?.trim();
  if (country) out.country = country.slice(0, 64);

  const tier = searchParams.get('tier')?.toUpperCase();
  if (tier && (VALID_TIERS as string[]).includes(tier)) {
    out.tier = tier as SupplierTier;
  }

  const businessType = searchParams.get('businessType')?.toUpperCase();
  if (businessType && (VALID_BUSINESS as string[]).includes(businessType)) {
    out.businessType = businessType as BusinessType;
  }

  const featured = searchParams.get('featured');
  if (featured === 'true') out.featured = true;
  else if (featured === 'false') out.featured = false;

  const sort = searchParams.get('sort');
  if (sort && (VALID_SORTS as string[]).includes(sort)) {
    out.sort = sort as SupplierListFilters['sort'];
  }

  const page = Number(searchParams.get('page'));
  if (Number.isFinite(page) && page >= 1) {
    out.page = Math.floor(page);
  }

  const pageSize = Number(searchParams.get('pageSize'));
  if (Number.isFinite(pageSize) && pageSize >= 1) {
    out.pageSize = Math.min(
      SUPPLIER_LIST_MAX_PAGE_SIZE,
      Math.max(1, Math.floor(pageSize))
    );
  } else {
    out.pageSize = SUPPLIER_LIST_DEFAULT_PAGE_SIZE;
  }

  return out;
}
