import type { Metadata } from 'next';
import Link from 'next/link';
import { SmartImage } from '@/components/ui/SmartImage';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { CategoryClientShell } from '@/components/category/CategoryClientShell';
import { BreadcrumbJsonLd } from '@/components/seo/JsonLd';
import { getCurrentUser } from '@/lib/auth/session';
import { getCategoryBySlug } from '@/lib/categories/service';
import {
  getCategoryProducts,
  getCategoryFacets,
  SORT_KEYS,
  type CategoryFilterState,
  type SortKey,
} from '@/lib/categories/filter';
import { getWishlistProductIds } from '@/lib/wishlist/service';
import { getEffectiveFilterSettings } from '@/lib/filters/settings';
import {
  SITE_NAME,
  buildAlternates,
  composeTitle,
  toOgAlternateLocales,
  toOgLocale,
  truncateDescription,
} from '@/lib/seo/site';

type SearchParams = Record<string, string | string[] | undefined>;
type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<SearchParams>;
};

/**
 * Parse URL search params into a strongly-typed `CategoryFilterState`.
 *
 * The URL is the source of truth for the filter state — every parameter
 * is validated/clamped here so the downstream layers never have to
 * defend against bad input (including hand-edited links and bot crawls).
 */
function parseFilters(sp: SearchParams): CategoryFilterState {
  const str = (key: string) => {
    const v = sp[key];
    return typeof v === 'string' ? v.trim() : undefined;
  };
  const num = (key: string): number | undefined => {
    const v = str(key);
    if (v === undefined) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const ids = (key: string): string[] => {
    const v = str(key);
    return v ? v.split(',').map((s) => s.trim()).filter(Boolean) : [];
  };

  const rawSort = str('sort');
  const sort: SortKey = (SORT_KEYS as readonly string[]).includes(rawSort ?? '')
    ? (rawSort as SortKey)
    : 'newest';

  // Attribute filters ride on `attr_<slug>=val1,val2`. Values may contain
  // commas by URL-encoding them (`%2C`) — split on raw ',' is fine for
  // the common case; edge cases round-trip through `decodeURIComponent`.
  const attrs: Record<string, string[]> = {};
  for (const key of Object.keys(sp)) {
    if (!key.startsWith('attr_')) continue;
    const slug = key.slice(5).toLowerCase();
    if (!/^[a-z0-9-]+$/.test(slug)) continue;
    const v = str(key);
    if (!v) continue;
    const vals = v.split(',').map((s) => s.trim()).filter(Boolean);
    if (vals.length > 0) attrs[slug] = vals;
  }

  const ratingRaw = num('rating');
  const rating =
    ratingRaw !== undefined && ratingRaw >= 1 && ratingRaw <= 5
      ? Math.floor(ratingRaw)
      : undefined;

  const q = str('q');

  return {
    sort,
    q: q && q.length >= 2 && q.length <= 120 ? q : undefined,
    minPrice: num('minPrice'),
    maxPrice: num('maxPrice'),
    brandIds: ids('brands'),
    supplierIds: ids('suppliers'),
    inStock: str('inStock') === 'true',
    isB2B: str('isB2B') === 'true',
    rating,
    hasDiscount: str('discount') === 'true',
    newArrivals: str('new') === 'true',
    page: Math.max(1, num('page') ?? 1),
    attrs,
  };
}

/**
 * Heuristic for "heavy filtering" → tells search engines that the page
 * is a long-tail combination not worth indexing. We still index the
 * canonical (unfiltered) URL and single-facet pages.
 */
function isHeavilyFiltered(f: CategoryFilterState): boolean {
  const dims =
    f.brandIds.length +
    f.supplierIds.length +
    Object.values(f.attrs).reduce((n, v) => n + v.length, 0) +
    (f.rating ? 1 : 0) +
    (f.hasDiscount ? 1 : 0) +
    (f.newArrivals ? 1 : 0) +
    (f.minPrice !== undefined || f.maxPrice !== undefined ? 1 : 0) +
    (f.inStock ? 1 : 0) +
    (f.isB2B ? 1 : 0) +
    (f.q ? 1 : 0);
  // Index the bare URL + single-dimension filters (Brand=Nike etc.). Deeper
  // combinations are noindex to avoid crawl-budget blowout.
  return dims >= 2 || f.page > 1 || Boolean(f.q);
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: 'categories' });
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: composeTitle(t('notFoundTitle')) };

  const filters = parseFilters(sp);
  const title = category.metaTitle || t('detailMetaTitle', { name: category.name });
  const description = truncateDescription(
    category.metaDescription ||
    t('detailMetaDescription', { name: category.name, count: category.productCount })
  );
  const path = `/categories/${category.slug}`;
  const shouldNoindex = category.productCount === 0 || isHeavilyFiltered(filters);

  return {
    title: composeTitle(title),
    description,
    alternates: buildAlternates(locale, path),
    robots: shouldNoindex ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      type: 'website', siteName: SITE_NAME, title, description,
      locale: toOgLocale(locale), alternateLocale: toOgAlternateLocales(locale),
      ...(category.imageUrl ? { images: [{ url: category.imageUrl, width: 1200, height: 630 }] } : {}),
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function CategoryDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { locale, slug } = await params;
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: 'categories' });

  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const filters = parseFilters(sp);

  const [{ products, total, page, pageSize, totalPages }, facets, user, filterSettings] =
    await Promise.all([
      getCategoryProducts(slug, filters),
      // Pass the active filters so facet counts reflect disjunctive
      // selections (Amazon-style: selecting Brand=Nike doesn't hide the
      // Adidas chip, just updates its count).
      getCategoryFacets(slug, filters),
      getCurrentUser(),
      // Merge global settings with the per-category override so admins
      // can hide, say, the B2B filter only inside "Home & Garden".
      getEffectiveFilterSettings(slug),
    ]);

  const wishlistIds = user
    ? Array.from(
        await getWishlistProductIds(user.id).catch(() => new Set<string>())
      )
    : [];

  return (
    <>
      <BreadcrumbJsonLd
        locale={locale}
        items={[
          { name: t('home'), path: '/' },
          { name: t('title'), path: '/categories' },
          { name: category.name, path: `/categories/${category.slug}` },
        ]}
      />

      <div className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="mb-4 flex flex-wrap items-center gap-1 text-xs text-slate-500" aria-label="Breadcrumb">
          <Link href={`/${locale}`} className="transition-colors hover:text-slate-900">{t('home')}</Link>
          <span className="select-none">/</span>
          <Link href={`/${locale}/categories`} className="transition-colors hover:text-slate-900">{t('title')}</Link>
          {category.parent && (
            <>
              <span className="select-none">/</span>
              <Link href={`/${locale}/categories/${category.parent.slug}`} className="transition-colors hover:text-slate-900">
                {category.parent.name}
              </Link>
            </>
          )}
          <span className="select-none">/</span>
          <span className="font-medium text-slate-700">{category.name}</span>
        </nav>

        {/* Category banner image */}
        {category.imageUrl && (
          <div className="relative mb-6 h-48 w-full overflow-hidden rounded-2xl bg-slate-100 md:h-64">
            <SmartImage
              src={category.imageUrl}
              alt={category.name}
              loading="eager"
              className="absolute inset-0 h-full w-full object-cover"
              sizes="(max-width:768px) 100vw, 1400px"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
            <div className="absolute bottom-5 left-6 flex items-center gap-3">
              {category.icon && (
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-3xl backdrop-blur-sm">
                  {category.icon}
                </span>
              )}
              <div>
                <h1 className="text-2xl font-black text-white drop-shadow lg:text-3xl">{category.name}</h1>
                <p className="text-sm text-white/80">{t('productCount', { count: category.productCount })}</p>
              </div>
            </div>
          </div>
        )}

        {/* Category header (no image) — H1 for SEO */}
        {!category.imageUrl && (
          <header className="mb-6 flex items-center gap-4">
            {category.icon && (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-3xl shadow-sm">
                {category.icon}
              </span>
            )}
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 lg:text-3xl">
                {category.name}
              </h1>
              <p className="mt-0.5 text-sm text-slate-500">{t('productCount', { count: category.productCount })}</p>
            </div>
          </header>
        )}

        {/* Subcategory chips */}
        {category.children && category.children.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {category.children.map((sub) => (
              <Link
                key={sub.id}
                href={`/${locale}/categories/${sub.slug}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
              >
                {sub.icon && <span>{sub.icon}</span>}
                {sub.name}
                <span className="text-slate-400">({sub.productCount})</span>
              </Link>
            ))}
          </div>
        )}

        {/* Filter + grid shell */}
        <CategoryClientShell
          category={category}
          products={products}
          facets={facets}
          filters={filters}
          pagination={{ page, pageSize, total, totalPages }}
          locale={locale}
          isAuthenticated={Boolean(user)}
          wishlistIds={wishlistIds}
          filterSettings={filterSettings}
        />

        {/* About section — below-the-fold, SEO-rich, non-intrusive */}
        {category.description && (
          <section
            aria-label={t('aboutTitle', { name: category.name })}
            className="mt-12 overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white"
          >
            <div className="border-b border-slate-200 px-6 py-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                {t('aboutTitle', { name: category.name })}
              </h2>
            </div>
            <div className="px-6 py-5">
              <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
                {category.description}
              </p>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
