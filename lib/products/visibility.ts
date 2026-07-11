import type { Prisma } from '@prisma/client';

/**
 * THE public-visibility rule for products, in one place.
 *
 * A product is publicly visible when the platform approved it AND the
 * supplier's own publish switch is on. Spread this into every storefront
 * `where` — search, category, related, homepage, sitemap, supplier profile,
 * cart/wishlist/review point lookups. Admin and owner-scoped queries must
 * NOT use it (they see everything).
 */
export const PUBLIC_PRODUCT_WHERE = {
  status: 'APPROVED',
  isPublished: true
} as const satisfies Prisma.ProductWhereInput;

/** Raw-SQL fragment of the same rule for hand-written queries (table alias `p`). */
export const PUBLIC_PRODUCT_SQL = `p."status" = 'APPROVED' AND p."isPublished" = true`;
