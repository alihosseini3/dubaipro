import 'server-only';

import type {
  BusinessType,
  CertificationStatus,
  SupplierStatus,
  SupplierTier
} from '@prisma/client';

/**
 * Shared types for the supplier subsystem.
 *
 * - DB-row shapes come from `@prisma/client` directly — do not duplicate.
 * - Public DTOs in this file are what storefront callers and API responses
 *   should return: a strict subset that hides admin-only / sensitive fields.
 */

/** Trust tier alias re-exported for ergonomic imports outside Prisma scope. */
export type Tier = SupplierTier;
export type Status = SupplierStatus;
export type CertStatus = CertificationStatus;
export type Business = BusinessType;

/**
 * Public-facing shape of a supplier — safe to return from non-admin routes.
 * Mirrors `/{locale}/suppliers/<slug>` requirements.
 */
export type SupplierPublic = {
  id: string;
  slug: string;
  name: string;
  shortTagline: string | null;
  description: string | null;
  country: string;
  city: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  tier: Tier;
  isFeatured: boolean;
  businessType: Business | null;
  yearEstablished: number | null;
  exportMarkets: string[];
  minOrderQuantity: number | null;
  shippingNotes: string | null;
  followerCount: number;
  ratingAvg: number;
  ratingCount: number;
  productCount: number;
  metaTitle: string | null;
  metaDescription: string | null;
  /** Years since the row was created — fact-based, never fabricated. */
  yearsOnPlatform: number;
  /** ISO timestamp of the latest verification grant, if any. */
  verifiedAt: string | null;
};

/** Lightweight supplier card used in listings and home rails. */
export type SupplierCard = Pick<
  SupplierPublic,
  | 'id'
  | 'slug'
  | 'name'
  | 'country'
  | 'logoUrl'
  | 'tier'
  | 'isFeatured'
  | 'shortTagline'
  | 'ratingAvg'
  | 'ratingCount'
  | 'followerCount'
> & { productCount: number };

/** Filter inputs for the public supplier listing. */
export type SupplierListFilters = {
  search?: string;
  country?: string;
  tier?: Tier;
  featured?: boolean;
  businessType?: Business;
  page?: number;
  pageSize?: number;
  sort?: 'recent' | 'top-rated' | 'most-followed' | 'name';
};

/** Paginated envelope shared by every list endpoint. */
export type Paginated<T> = {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export const SUPPLIER_LIST_DEFAULT_PAGE_SIZE = 24;
export const SUPPLIER_LIST_MAX_PAGE_SIZE = 60;

/** Standard verification-log action codes. Free-form strings allowed too. */
export const VERIFICATION_ACTIONS = [
  'SUBMIT_DOCS',
  'APPROVE_TIER',
  'REJECT',
  'SUSPEND',
  'RESTORE',
  'BLACKLIST',
  'FEATURE',
  'UNFEATURE',
  'EXPIRE',
  'NOTE'
] as const;
export type VerificationAction = (typeof VERIFICATION_ACTIONS)[number] | string;
