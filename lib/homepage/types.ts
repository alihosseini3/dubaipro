import type { HomepageSectionType } from '@prisma/client';

/**
 * Per-type configuration shapes for `HomepageSection.config`.
 *
 * The DB column is `Json` so we can iterate without migrations every
 * time a section grows a new knob, but consumers MUST go through this
 * file so the typed surface stays consistent. Always default-merge
 * with these shapes — never trust the raw row.
 */

/** No extra config — every field on the row is enough. */
export type EmptyConfig = Record<string, never>;

/** HERO — optional list of trust chips shown under the CTAs. */
export type HeroConfig = {
  /** Three short trust badges, e.g. "Verified", "Fast shipping". */
  chips?: string[];
};

/** CATEGORIES — pick which categories appear and in what slot count. */
export type CategoriesConfig = {
  /** Optional whitelist of category IDs (in order). When empty/undef
   *  the section auto-loads the most populated categories. */
  categoryIds?: string[];
  /** Soft cap (default 8). Storefront ignores values <2 / >12. */
  limit?: number;
};

/** FEATURED_PRODUCTS — pin specific products or auto-load latest. */
export type FeaturedProductsConfig = {
  /** Optional whitelist of product IDs (in order). */
  productIds?: string[];
  /** Soft cap (default 8). Range [4, 16]. */
  limit?: number;
};

/** TRUST — accent-coloured benefit chips. Defaults are seeded. */
export type TrustConfig = {
  items?: Array<{
    /** Short heading, e.g. "Verified suppliers". */
    title: string;
    /** One-line description. */
    description: string;
    /** Lucide-style icon key recognised by `TrustSection`. One of:
     *  `truck | shield | lock | tag | globe | bolt`. */
    icon?: string;
  }>;
};

/** BECOME_SUPPLIER — bulleted benefits below the headline. */
export type BecomeSupplierConfig = {
  benefits?: string[];
};

/** RFQ — banner with a single big CTA. No extra config today. */
export type RfqConfig = EmptyConfig;

/** GLOBAL_SHOPPING — one card per platform we shop on behalf of buyers
 *  (Amazon UAE, Noon, Shein, Alibaba, Dubai markets, …). */
export type GlobalShoppingConfig = {
  cards?: Array<{
    /** Display title (e.g. "Amazon UAE"). */
    title: string;
    /** One-line description. */
    description: string;
    /** Button label, e.g. "Start order". */
    ctaLabel?: string;
    /** Path or full URL. Path is locale-prefixed at render time. */
    ctaHref?: string;
    /** Icon key recognised by `GlobalShoppingSection`. One of:
     *  `cart | package | sparkle | warehouse | building | tag`. */
    icon?: string;
    /** Accent palette key. One of:
     *  `orange | sky | violet | emerald | rose | amber`. */
    accent?: string;
  }>;
};

/** TOP_SUPPLIERS — pinned supplier IDs or auto-load top N. */
export type TopSuppliersConfig = {
  /** Optional whitelist of supplier IDs (in order). */
  supplierIds?: string[];
  /** Soft cap (default 6). Range [3, 12]. */
  limit?: number;
};

/** AUCTION — config-driven items until a real Auction model lands.
 *  Each item is a static card the admin types in. */
export type AuctionConfig = {
  items?: Array<{
    title: string;
    /** Image URL (required for visual cards). */
    imageUrl?: string;
    /** Current bid amount in `currency`. */
    currentBid: number;
    /** ISO currency code (defaults to AED). */
    currency?: string;
    /** ISO 8601 timestamp; renders a live "ends in" countdown. */
    endsAt?: string;
    /** Click destination — typically `/auctions/<slug>`. */
    href?: string;
  }>;
};

/** BLOG — pin specific posts or auto-load latest published. */
export type BlogConfig = {
  /** Optional whitelist of post IDs (in order). */
  postIds?: string[];
  /** Soft cap (default 3). Range [2, 6]. */
  limit?: number;
};

/** Map of section type → its config shape. Keep additions in sync
 *  when new section types ship in later phases. */
export type SectionConfigByType = {
  HERO: HeroConfig;
  CATEGORIES: CategoriesConfig;
  FEATURED_PRODUCTS: FeaturedProductsConfig;
  TRUST: TrustConfig;
  BECOME_SUPPLIER: BecomeSupplierConfig;
  RFQ: RfqConfig;
  GLOBAL_SHOPPING: GlobalShoppingConfig;
  TOP_SUPPLIERS: TopSuppliersConfig;
  AUCTION: AuctionConfig;
  BLOG: BlogConfig;
};

/** Strongly-typed section row shared between server and admin UI. */
export type HomepageSectionDTO = {
  id: string;
  type: HomepageSectionType;
  title: string;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  ctaSecondaryLabel: string | null;
  ctaSecondaryHref: string | null;
  badge: string | null;
  imageUrl: string | null;
  /** Always returned as a normal object (never `null`) so consumers
   *  can read `dto.config.productIds` without optional-chaining. */
  config: Record<string, unknown>;
  isActive: boolean;
  order: number;
};
