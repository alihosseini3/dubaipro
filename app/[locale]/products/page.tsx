import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { BreadcrumbJsonLd } from '@/components/seo/JsonLd';
import { ProductsClientShell } from '@/components/products/ProductsClientShell';
import { getCurrentUser } from '@/lib/auth/session';
import {
  sanitizeQuery,
  getFilteredProductListing,
  getProductListingFacets,
} from '@/lib/search/service';
import { getWishlistProductIds } from '@/lib/wishlist/service';
import { getFilterSettings } from '@/lib/filters/settings';
import {
  SITE_NAME,
  buildAlternates,
  composeTitle,
  toOgAlternateLocales,
  toOgLocale,
  truncateDescription,
} from '@/lib/seo/site';
import type { CategoryFilterState } from '@/lib/categories/filter';

type SearchParams = Record<string, string | string[] | undefined>;
type PageParams = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<SearchParams>;
};

function str(sp: SearchParams | undefined, key: string): string | undefined {
  const v = sp?.[key];
  if (Array.isArray(v)) return v[0]?.trim();
  return typeof v === 'string' ? v.trim() : undefined;
}

function num(sp: SearchParams | undefined, key: string): number | undefined {
  const v = str(sp, key);
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function ids(sp: SearchParams | undefined, key: string): string[] {
  const v = str(sp, key);
  return v ? v.split(',').map((s) => s.trim()).filter(Boolean) : [];
}

function parseFilters(sp: SearchParams | undefined): CategoryFilterState {
  const rawSort = str(sp, 'sort');
  const sort: CategoryFilterState['sort'] =
    rawSort === 'price_asc' || rawSort === 'price_desc' || rawSort === 'popular' || rawSort === 'newest'
      ? rawSort
      : 'newest';

  const attrs: Record<string, string[]> = {};
  if (sp) {
    for (const key of Object.keys(sp)) {
      if (key.startsWith('attr_')) {
        const slug = key.slice(5);
        const v = str(sp, key);
        if (v) attrs[slug] = v.split(',').map((s) => s.trim()).filter(Boolean);
      }
    }
  }

  return {
    sort,
    // Search query/rating/discount/new-arrivals aren't exposed on the
    // generic listing page yet — keep them unset so the CategoryFilterState
    // shape still type-checks against the shared UI components.
    q:           undefined,
    minPrice:    num(sp, 'minPrice'),
    maxPrice:    num(sp, 'maxPrice'),
    brandIds:    ids(sp, 'brands'),
    supplierIds: ids(sp, 'suppliers'),
    inStock:     str(sp, 'inStock') === 'true',
    isB2B:       str(sp, 'isB2B') === 'true',
    rating:      undefined,
    hasDiscount: false,
    newArrivals: false,
    page:        Math.max(1, num(sp, 'page') ?? 1),
    attrs,
  };
}

const LOW_VALUE_PARAMS = new Set([
  'q', 'search', 'category', 'page', 'sort', 'pageSize',
  'minPrice', 'maxPrice', 'brands', 'suppliers', 'inStock', 'isB2B',
]);

function isFilteredView(sp: SearchParams | undefined): boolean {
  if (!sp) return false;
  return Object.keys(sp).some((k) => LOW_VALUE_PARAMS.has(k));
}

export async function generateMetadata({ params, searchParams }: PageParams): Promise<Metadata> {
  const { locale } = await params;
  const sp = searchParams ? await searchParams : undefined;
  const t = await getTranslations({ locale, namespace: 'products' });
  const title = t('metaTitle');
  const description = truncateDescription(t('metaDescription'));
  return {
    title: composeTitle(title),
    description,
    alternates: buildAlternates(locale, '/products'),
    robots: isFilteredView(sp) ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title,
      description,
      locale: toOgLocale(locale),
      alternateLocale: toOgAlternateLocales(locale),
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function ProductsPage({ params, searchParams }: PageParams) {
  const { locale } = await params;
  const sp = searchParams ? await searchParams : undefined;
  const t = await getTranslations({ locale, namespace: 'products' });

  const rawQuery = str(sp, 'q') ?? str(sp, 'search');
  const query = sanitizeQuery(rawQuery) ?? '';
  const filters = parseFilters(sp);

  const [{ products, total, page, pageSize, totalPages }, facets, user, filterSettings] = await Promise.all([
    getFilteredProductListing({ ...filters, query }),
    getProductListingFacets(query || null),
    getCurrentUser(),
    getFilterSettings(),
  ]);

  const wishlistIds = user
    ? Array.from(
        await getWishlistProductIds(user.id).catch(() => new Set<string>())
      )
    : [];

  const heading = query
    ? t('searchResultsFor', { q: query, count: total })
    : t('title');
  const sub = query ? t('searchSubtitle', { count: total }) : t('subtitle');

  return (
    <section className="space-y-6">
      <BreadcrumbJsonLd
        locale={locale}
        items={[
          { name: t('home'), path: '/' },
          { name: t('title'), path: '/products' },
        ]}
      />

      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          {heading}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{sub}</p>
      </header>

      <ProductsClientShell
        products={products}
        facets={facets}
        filters={filters}
        query={query}
        pagination={{ page, pageSize, total, totalPages }}
        locale={locale}
        isAuthenticated={Boolean(user)}
        wishlistIds={wishlistIds}
        filterSettings={filterSettings}
      />
    </section>
  );
}
