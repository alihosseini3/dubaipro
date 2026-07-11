import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { PUBLIC_PRODUCT_WHERE } from '@/lib/products/visibility';
import type { FilteredProduct, FilterFacets, CategoryFilterState } from '@/lib/categories/filter';

/**
 * Storefront search service.
 *
 * Two surfaces:
 *   - `searchSuggestions(q)` → tiny payload for the header autocomplete
 *     dropdown (≤10 products + ≤5 brands + ≤5 categories).
 *   - `searchProducts(q, opts)` → the full result set used by the
 *     `/products?q=` listing page.
 *
 * Performance contract: every read uses `select` (never `include *`),
 * uses an index-backed filter (title btree + slug unique + brand.name +
 * category.name), and returns under 200ms on a warm connection for a
 * catalogue up to ~100k rows. For larger catalogues swap the
 * `contains` filter for Postgres `pg_trgm` similarity.
 */

export const SEARCH_MAX_QUERY_LEN = 100;

export type ProductSuggestion = {
  id: string;
  title: string;
  slug: string;
  price: number;
  currency: string;
  imageUrl: string | null;
  categoryName: string;
  categorySlug: string;
  brandName: string | null;
};

export type BrandSuggestion = { id: string; name: string; slug: string };
export type CategorySuggestion = { id: string; name: string; slug: string };

export type SearchSuggestionsResponse = {
  products: ProductSuggestion[];
  brands: BrandSuggestion[];
  categories: CategorySuggestion[];
};

/**
 * Trim, collapse whitespace and clamp length. Returns null if the
 * cleaned query is too short (< 1 char) — callers should treat that as
 * "no query, don't search".
 */
export function sanitizeQuery(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  // Strip control chars + collapse internal whitespace. Don't escape
  // SQL — Prisma parameterises everything for us.
  const cleaned = raw
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, SEARCH_MAX_QUERY_LEN);
  return cleaned.length > 0 ? cleaned : null;
}

/* -------------------------------------------------------------------------- */
/* Suggestions (header autocomplete)                                          */
/* -------------------------------------------------------------------------- */

const SUGGEST_PRODUCTS = 10;
const SUGGEST_BRANDS = 5;
const SUGGEST_CATEGORIES = 5;

/**
 * Match-priority scoring used to rank a product within suggestion
 * results. Lower = better. We compute it in JS after fetching a
 * shallow window, instead of a CASE-WHEN in SQL, because it keeps the
 * query plan trivial (single OR + index seek) and the post-sort runs
 * over ≤30 rows.
 */
function rankProduct(p: { title: string; slug: string }, qLower: string): number {
  const title = p.title.toLowerCase();
  const slug = p.slug.toLowerCase();
  if (title === qLower) return 0;
  if (title.startsWith(qLower)) return 1;
  if (title.includes(qLower)) return 2;
  if (slug.startsWith(qLower)) return 3;
  if (slug.includes(qLower)) return 4;
  return 5;
}

export async function searchSuggestions(
  rawQuery: string
): Promise<SearchSuggestionsResponse> {
  const q = sanitizeQuery(rawQuery);
  if (!q) return { products: [], brands: [], categories: [] };

  const ci: Prisma.QueryMode = 'insensitive';
  const qLower = q.toLowerCase();

  // Fetch a slightly larger window than we'll return so the in-JS
  // re-rank has room to surface the best matches. 30 = SUGGEST*3.
  const PRODUCT_WINDOW = SUGGEST_PRODUCTS * 3;

  const [productsRaw, brands, categories] = await Promise.all([
    prisma.product.findMany({
      where: {
        ...PUBLIC_PRODUCT_WHERE,
        OR: [
          { title: { contains: q, mode: ci } },
          { slug: { contains: q, mode: ci } },
          { brand: { name: { contains: q, mode: ci } } },
          { category: { name: { contains: q, mode: ci } } }
        ]
      },
      // Newest-first as a stable tiebreaker after we re-rank in JS.
      orderBy: { createdAt: 'desc' },
      take: PRODUCT_WINDOW,
      select: {
        id: true,
        title: true,
        slug: true,
        price: true,
        currency: true,
        imageUrl: true,
        category: { select: { name: true, slug: true } },
        brand: { select: { name: true } }
      }
    }),
    prisma.brand.findMany({
      where: { name: { contains: q, mode: ci } },
      orderBy: { name: 'asc' },
      take: SUGGEST_BRANDS,
      select: { id: true, name: true, slug: true }
    }),
    prisma.category.findMany({
      where: { name: { contains: q, mode: ci } },
      orderBy: { name: 'asc' },
      take: SUGGEST_CATEGORIES,
      select: { id: true, name: true, slug: true }
    })
  ]);

  const products = productsRaw
    .map((p) => ({ p, rank: rankProduct(p, qLower) }))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, SUGGEST_PRODUCTS)
    .map(({ p }): ProductSuggestion => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      // Decimal -> number coercion. Catalogue prices are well under
      // Number.MAX_SAFE_INTEGER (2^53), so this is safe for display.
      price: Number(p.price),
      currency: p.currency,
      imageUrl: p.imageUrl,
      categoryName: p.category.name,
      categorySlug: p.category.slug,
      brandName: p.brand?.name ?? null
    }));

  return { products, brands, categories };
}

/* -------------------------------------------------------------------------- */
/* Full search (products listing page)                                        */
/* -------------------------------------------------------------------------- */

export type ProductSearchOptions = {
  query?: string | null;
  categorySlug?: string | null;
  page?: number;
  pageSize?: number;
};

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 60;

export async function searchProducts(opts: ProductSearchOptions = {}) {
  const q = sanitizeQuery(opts.query ?? null);
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.floor(opts.pageSize ?? DEFAULT_PAGE_SIZE))
  );
  const ci: Prisma.QueryMode = 'insensitive';

  const where: Prisma.ProductWhereInput = { ...PUBLIC_PRODUCT_WHERE };

  if (q) {
    where.OR = [
      { title: { contains: q, mode: ci } },
      { slug: { contains: q, mode: ci } },
      { description: { contains: q, mode: ci } },
      { brand: { name: { contains: q, mode: ci } } },
      { category: { name: { contains: q, mode: ci } } }
    ];
  }

  if (opts.categorySlug) {
    where.category = { slug: opts.categorySlug };
  }

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        brand: { select: { id: true, name: true, slug: true } },
        supplier: {
          select: {
            id: true,
            userId: true,
            name: true,
            country: true,
            phone: true
          }
        }
      }
    }),
    prisma.product.count({ where })
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  };
}

/**
 * Top-N most recent products — used as the "no results" fallback on
 * the search page. Uses the existing `createdAt` index, no scan.
 */
export async function getPopularProducts(limit = 12) {
  return prisma.product.findMany({
    where: { ...PUBLIC_PRODUCT_WHERE },
    orderBy: { createdAt: 'desc' },
    take: Math.min(MAX_PAGE_SIZE, Math.max(1, limit)),
    include: {
      category: { select: { id: true, name: true, slug: true } },
      brand: { select: { id: true, name: true, slug: true } },
      supplier: {
        select: {
          id: true,
          userId: true,
          name: true,
          country: true,
          phone: true
        }
      }
    }
  });
}

/* -------------------------------------------------------------------------- */
/* Filtered product listing — products page with full filter + search support */
/* -------------------------------------------------------------------------- */

export type ProductListingFilterState = CategoryFilterState & { query: string };

function buildProductListingWhere(
  filters: Partial<ProductListingFilterState>
): Prisma.ProductWhereInput {
  const ci: Prisma.QueryMode = 'insensitive';
  const q = sanitizeQuery(filters.query ?? null);
  // Storefront listings never show unapproved/unpublished products.
  const where: Prisma.ProductWhereInput = { ...PUBLIC_PRODUCT_WHERE };

  if (q) {
    where.OR = [
      { title: { contains: q, mode: ci } },
      { slug: { contains: q, mode: ci } },
      { description: { contains: q, mode: ci } },
      { brand: { name: { contains: q, mode: ci } } },
      { category: { name: { contains: q, mode: ci } } },
    ];
  }

  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    const pf: Prisma.DecimalNullableFilter = {};
    if (filters.minPrice !== undefined) pf.gte = filters.minPrice;
    if (filters.maxPrice !== undefined) pf.lte = filters.maxPrice;
    where.price = pf as Prisma.DecimalFilter;
  }

  if (filters.brandIds?.length) where.brandId = { in: filters.brandIds };
  if (filters.supplierIds?.length) where.supplierId = { in: filters.supplierIds };
  if (filters.inStock) where.stock = { gt: 0 };
  if (filters.isB2B) where.isB2B = true;

  if (filters.attrs && Object.keys(filters.attrs).length > 0) {
    const attrConditions: Prisma.ProductWhereInput[] = Object.entries(filters.attrs)
      .filter(([, vals]) => vals.length > 0)
      .map(([slug, vals]) => ({
        attributeValues: { some: { attribute: { slug }, value: { in: vals } } },
      }));
    if (attrConditions.length > 0) where.AND = attrConditions;
  }

  return where;
}

export async function getProductListingFacets(
  query?: string | null
): Promise<FilterFacets> {
  const baseWhere = buildProductListingWhere({ query: query ?? '' });

  const [priceAgg, brands, suppliers] = await Promise.all([
    prisma.product.aggregate({
      where: baseWhere,
      _min: { price: true },
      _max: { price: true },
    }),
    prisma.brand.findMany({
      where: { products: { some: baseWhere } },
      select: {
        id: true,
        name: true,
        slug: true,
        _count: { select: { products: { where: baseWhere } } },
      },
      orderBy: { name: 'asc' },
      take: 50,
    }),
    prisma.supplier.findMany({
      where: { products: { some: baseWhere } },
      select: {
        id: true,
        name: true,
        _count: { select: { products: { where: baseWhere } } },
      },
      orderBy: { name: 'asc' },
      take: 50,
    }),
  ]);

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
    attributes: [], // products page has no category context — no attribute facets
    ratings: [], // rating / discount / new-arrivals facets live on the
    discountCount: 0, // category-scoped listing only; the generic products
    newArrivalsCount: 0, // page stays lean.
  };
}

export async function getFilteredProductListing(
  filters: Partial<ProductListingFilterState> = {}
) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = 24;
  const where = buildProductListingWhere(filters);

  let orderBy: Prisma.ProductOrderByWithRelationInput;
  switch (filters.sort) {
    case 'price_asc':  orderBy = { price: 'asc' };       break;
    case 'price_desc': orderBy = { price: 'desc' };      break;
    default:           orderBy = { createdAt: 'desc' };  break;
  }

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

  // Batch-fetch ratings to avoid N+1
  const productIds = items.map((p) => p.id);
  const ratings = productIds.length
    ? await prisma.review.groupBy({
        by: ['productId'],
        where: { productId: { in: productIds } },
        _avg: { rating: true },
        _count: { rating: true },
      })
    : [];

  const ratingMap = new Map(
    ratings.map((r) => [r.productId, { avg: r._avg.rating, count: r._count.rating }])
  );

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

  return {
    products,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
