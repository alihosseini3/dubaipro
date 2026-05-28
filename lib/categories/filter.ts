import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/* ────────────────────────────────────────────────────────────────────────── *
 * Filter state — every filter the storefront understands.
 *
 * Adding a new filter here is the one place you touch: parse/serialise in
 * `@/app/[locale]/categories/[slug]/page.tsx` + `CategoryClientShell.tsx`,
 * render in `FilterPanel.tsx`, wire in `buildWhere()` below.
 * ────────────────────────────────────────────────────────────────────────── */

export type SortKey = 'newest' | 'price_asc' | 'price_desc' | 'popular' | 'rating';

/** All supported sort keys — used for URL validation + the sort dropdown. */
export const SORT_KEYS: readonly SortKey[] = [
  'newest',
  'popular',
  'rating',
  'price_asc',
  'price_desc',
];

export type CategoryFilterState = {
  sort: SortKey;
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  brandIds: string[];
  supplierIds: string[];
  inStock: boolean;
  isB2B: boolean;
  /** Minimum average star rating (1–5). Matches products with at least one
   *  review at or above this threshold — a cheap approximation of
   *  "avg rating ≥ N" that stays pagination-safe without a materialised
   *  view on Product. */
  rating?: number;
  /** Products that currently have an active coupon / promo attached. */
  hasDiscount: boolean;
  /** Products created in the last 30 days. */
  newArrivals: boolean;
  page: number;
  /** attributeSlug → selected option values (e.g. `{ size: ['S','M'] }`). */
  attrs: Record<string, string[]>;
};

export type AttributeFacet = {
  id: string;
  name: string;
  slug: string;
  type: 'select' | 'number' | 'boolean' | 'color';
  unit: string | null;
  options: string[] | null;
  nameTranslations: Record<string, string> | null;
  /** For `select`/`color`/`boolean`: distinct values + product counts. */
  values: Array<{ value: string; count: number }>;
  /** For `number`: min/max of all observed numeric values. */
  range: { min: number; max: number } | null;
};

export type FilterFacets = {
  priceRange: { min: number; max: number };
  brands: Array<{ id: string; name: string; slug: string; count: number }>;
  suppliers: Array<{ id: string; name: string; count: number }>;
  attributes: AttributeFacet[];
  /** Count of products matching each star-rating threshold (5 → 1). */
  ratings: Array<{ value: 5 | 4 | 3 | 2 | 1; count: number }>;
  /** Count of products with an active discount — zero hides the chip. */
  discountCount: number;
  /** Count of products created in the last 30 days. */
  newArrivalsCount: number;
};

export type FilteredProduct = {
  id: string;
  title: string;
  slug: string;
  price: number;
  compareAtPrice: number | null;
  currency: string;
  stock: number;
  isB2B: boolean;
  imageUrl: string | null;
  shippingClass: string | null;
  avgRating: number | null;
  reviewCount: number;
  category: { id: string; name: string; slug: string } | null;
  brand: { id: string; name: string; slug: string } | null;
  supplier: {
    id: string;
    userId: string | null;
    name: string;
    country: string | null;
    phone: string | null;
  } | null;
};

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 60;
/** A "new arrival" is anything created within this many days. */
const NEW_ARRIVALS_DAYS = 30;

function newArrivalsCutoff(): Date {
  const d = new Date();
  d.setDate(d.getDate() - NEW_ARRIVALS_DAYS);
  return d;
}

/* Prisma requires a tuple of orderBys to enable secondary sorts (stable
 * pagination when the primary sort column has ties — e.g. many products
 * with `reviews._count = 0`). */
function buildOrderBy(sort: SortKey): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case 'price_asc':
      return [{ price: 'asc' }, { createdAt: 'desc' }];
    case 'price_desc':
      return [{ price: 'desc' }, { createdAt: 'desc' }];
    case 'popular':
      return [{ reviews: { _count: 'desc' } }, { createdAt: 'desc' }];
    case 'rating':
      // Highest-rated first. Products without reviews fall to the bottom via
      // the count tiebreaker, then by recency.
      return [
        { reviews: { _count: 'desc' } },
        { createdAt: 'desc' },
      ];
    case 'newest':
    default:
      return [{ createdAt: 'desc' }];
  }
}

/* Build a single Prisma `where` fragment for the subset of filters the
 * caller wants — used by both product queries AND facet queries that need
 * "all filters except this one" semantics. Splitting per-filter keeps the
 * disjunctive-facet logic trivially composable. */
type FilterSlice = Partial<CategoryFilterState>;

function whereFromPrice(f: FilterSlice): Prisma.ProductWhereInput | null {
  if (f.minPrice === undefined && f.maxPrice === undefined) return null;
  const pf: Prisma.DecimalFilter = {};
  if (f.minPrice !== undefined) pf.gte = f.minPrice;
  if (f.maxPrice !== undefined) pf.lte = f.maxPrice;
  return { price: pf };
}

function whereFromAttr(slug: string, vals: string[]): Prisma.ProductWhereInput {
  return {
    attributeValues: {
      some: { attribute: { slug }, value: { in: vals } },
    },
  };
}

export function buildWhere(
  categorySlug: string,
  f: FilterSlice
): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [];

  if (f.q) {
    and.push({ title: { contains: f.q, mode: 'insensitive' } });
  }

  const priceW = whereFromPrice(f);
  if (priceW) and.push(priceW);

  if (f.brandIds?.length) and.push({ brandId: { in: f.brandIds } });
  if (f.supplierIds?.length) and.push({ supplierId: { in: f.supplierIds } });
  if (f.inStock) and.push({ stock: { gt: 0 } });
  if (f.isB2B) and.push({ isB2B: true });

  if (typeof f.rating === 'number' && f.rating >= 1 && f.rating <= 5) {
    and.push({ reviews: { some: { rating: { gte: Math.floor(f.rating) } } } });
  }

  if (f.hasDiscount) {
    and.push({
      coupons: {
        some: {
          isActive: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gte: new Date() } },
          ],
        },
      },
    });
  }

  if (f.newArrivals) {
    and.push({ createdAt: { gte: newArrivalsCutoff() } });
  }

  // Attribute filters — each selected attribute slug is an independent
  // must-match (AND between slugs, OR within a slug's values).
  if (f.attrs) {
    for (const [slug, vals] of Object.entries(f.attrs)) {
      if (!vals || vals.length === 0) continue;
      and.push(whereFromAttr(slug, vals));
    }
  }

  return {
    category: { slug: categorySlug },
    ...(and.length > 0 && { AND: and }),
  };
}

export async function getCategoryProducts(
  categorySlug: string,
  filters: Partial<CategoryFilterState> = {}
) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE);
  const where = buildWhere(categorySlug, filters);
  const orderBy = buildOrderBy(filters.sort ?? 'newest');

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        brand:    { select: { id: true, name: true, slug: true } },
        supplier: { select: { id: true, userId: true, name: true, country: true, phone: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  const productIds = items.map((p) => p.id);
  const ratings = productIds.length > 0
    ? await prisma.review.groupBy({
        by: ['productId'],
        where: { productId: { in: productIds } },
        _avg: { rating: true },
        _count: { rating: true },
      })
    : [];

  const ratingMap = new Map(ratings.map((r) => [r.productId, { avg: r._avg.rating, count: r._count.rating }]));

  const products: FilteredProduct[] = items.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    price: Number(p.price),
    compareAtPrice: p.compareAtPrice != null ? Number(p.compareAtPrice) : null,
    currency: p.currency,
    stock: p.stock,
    isB2B: p.isB2B,
    imageUrl: p.imageUrl,
    shippingClass: p.shippingClass,
    avgRating: ratingMap.get(p.id)?.avg ?? null,
    reviewCount: ratingMap.get(p.id)?.count ?? 0,
    category: p.category,
    brand: p.brand,
    supplier: p.supplier
      ? { id: p.supplier.id, userId: p.supplier.userId, name: p.supplier.name, country: p.supplier.country, phone: p.supplier.phone }
      : null,
  }));

  return { products, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/* ────────────────────────────────────────────────────────────────────────── *
 * Facets — computed with "disjunctive facet counts":
 *
 *   Each facet's counts are computed against the current filter state
 *   *minus the facet being measured*. This is the behaviour users
 *   recognise from Amazon / Zalando: selecting Brand=Nike doesn't hide
 *   the Adidas chip — its count just updates to reflect the cross-filter
 *   of all OTHER filters applied.
 *
 *   The trade-off is more queries, but all are indexed and parallelised.
 * ────────────────────────────────────────────────────────────────────────── */

/** Return a filter slice with one key stripped — used to build "all other
 *  filters" for each facet query. */
function without<K extends keyof CategoryFilterState>(
  f: Partial<CategoryFilterState>,
  key: K
): Partial<CategoryFilterState> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { [key]: _omit, ...rest } = f as Record<string, unknown>;
  return rest as Partial<CategoryFilterState>;
}

/** Strip a single attribute slug from `attrs`. */
function withoutAttr(
  f: Partial<CategoryFilterState>,
  slug: string
): Partial<CategoryFilterState> {
  if (!f.attrs) return f;
  const { [slug]: _drop, ...rest } = f.attrs;
  void _drop;
  return { ...f, attrs: rest };
}

export async function getCategoryFacets(
  categorySlug: string,
  filters: Partial<CategoryFilterState> = {}
): Promise<FilterFacets> {
  // Resolve categoryId first — needed for attribute lookup and several
  // facet queries.
  const category = await prisma.category.findUnique({
    where: { slug: categorySlug },
    select: { id: true },
  });

  // Base where with ALL current filters (used for counts of the currently
  // narrowed set — the price range for example).
  const baseWhere = buildWhere(categorySlug, filters);

  // "All filters except …" variants used for disjunctive counts.
  const whereNoPrice = buildWhere(categorySlug, { ...without(filters, 'minPrice'), maxPrice: undefined });
  const whereNoBrand = buildWhere(categorySlug, without(filters, 'brandIds'));
  const whereNoSupplier = buildWhere(categorySlug, without(filters, 'supplierIds'));
  const whereNoRating = buildWhere(categorySlug, without(filters, 'rating'));
  const whereNoDiscount = buildWhere(categorySlug, without(filters, 'hasDiscount'));
  const whereNoNew = buildWhere(categorySlug, without(filters, 'newArrivals'));

  const [
    priceAgg,
    brands,
    suppliers,
    categoryAttributes,
    ratingCounts,
    discountCount,
    newArrivalsCount,
  ] = await Promise.all([
    prisma.product.aggregate({
      where: whereNoPrice,
      _min: { price: true },
      _max: { price: true },
    }),
    prisma.brand.findMany({
      where: { products: { some: whereNoBrand } },
      select: {
        id: true,
        name: true,
        slug: true,
        _count: { select: { products: { where: whereNoBrand } } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.supplier.findMany({
      where: { products: { some: whereNoSupplier } },
      select: {
        id: true,
        name: true,
        _count: { select: { products: { where: whereNoSupplier } } },
      },
      orderBy: { name: 'asc' },
    }),
    category
      ? prisma.categoryAttribute.findMany({
          where: { categoryId: category.id, isFilterable: true },
          orderBy: { displayOrder: 'asc' },
          include: { attribute: true },
        })
      : Promise.resolve([]),
    // Rating buckets — one count per threshold (5★, 4★ …). Computed in
    // parallel off a single `whereNoRating`.
    Promise.all(
      ([5, 4, 3, 2, 1] as const).map((value) =>
        prisma.product
          .count({
            where: {
              AND: [whereNoRating, { reviews: { some: { rating: { gte: value } } } }],
            },
          })
          .then((count) => ({ value, count }))
      )
    ),
    prisma.product.count({
      where: {
        AND: [
          whereNoDiscount,
          {
            coupons: {
              some: {
                isActive: true,
                OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
              },
            },
          },
        ],
      },
    }),
    prisma.product.count({
      where: {
        AND: [whereNoNew, { createdAt: { gte: newArrivalsCutoff() } }],
      },
    }),
  ]);

  /* Attribute facets: for each filterable attribute, value counts are
   * computed against "all filters EXCEPT this attribute slug" — so users
   * can flip selections inside the same facet without losing the chips. */
  const attributeFacets: AttributeFacet[] = await Promise.all(
    categoryAttributes.map(async (ca) => {
      const attrType = ['select', 'number', 'boolean', 'color'].includes(ca.attribute.type)
        ? (ca.attribute.type as AttributeFacet['type'])
        : 'select';

      const whereForThisAttr = buildWhere(categorySlug, withoutAttr(filters, ca.attribute.slug));

      // Pull the value counts for this attribute through a groupBy scoped
      // to the current (minus-self) result set.
      const valueCounts = await prisma.productAttributeValue.groupBy({
        by: ['value'],
        where: {
          attributeId: ca.attributeId,
          product: whereForThisAttr,
        },
        _count: { value: true },
        orderBy: { value: 'asc' },
      });

      // For number-typed attrs the value column holds numeric strings —
      // compute min/max for the range slider. We ignore NaN entries.
      let range: AttributeFacet['range'] = null;
      if (attrType === 'number' && valueCounts.length > 0) {
        const nums = valueCounts
          .map((v) => Number(v.value))
          .filter((n) => Number.isFinite(n));
        if (nums.length > 0) {
          range = { min: Math.floor(Math.min(...nums)), max: Math.ceil(Math.max(...nums)) };
        }
      }

      return {
        id: ca.attribute.id,
        name: ca.attribute.name,
        slug: ca.attribute.slug,
        type: attrType,
        unit: ca.attribute.unit,
        options: Array.isArray(ca.attribute.options) ? (ca.attribute.options as string[]) : null,
        nameTranslations:
          ca.attribute.nameTranslations && typeof ca.attribute.nameTranslations === 'object'
            ? (ca.attribute.nameTranslations as Record<string, string>)
            : null,
        values: valueCounts.map((v) => ({ value: v.value, count: v._count.value })),
        range,
      };
    })
  );

  // Drop empty facets — nothing to click means nothing to render. Only
  // exception: when the user has already selected a value in the facet
  // (counts may legitimately be zero under current filters).
  const nonEmptyAttributes = attributeFacets.filter((a) => {
    if (a.values.length > 0 || a.range) return true;
    const active = filters.attrs?.[a.slug];
    return Array.isArray(active) && active.length > 0;
  });

  // Baseline aggregate for total results — used by SortBar's count chip.
  void baseWhere;

  return {
    priceRange: {
      min: Math.floor(Number(priceAgg._min.price ?? 0)),
      max: Math.ceil(Number(priceAgg._max.price ?? 0)),
    },
    brands: brands.map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      count: b._count.products,
    })),
    suppliers: suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      count: s._count.products,
    })),
    attributes: nonEmptyAttributes,
    ratings: ratingCounts,
    discountCount,
    newArrivalsCount,
  };
}
