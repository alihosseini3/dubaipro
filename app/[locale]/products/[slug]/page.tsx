import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { Price } from '@/components/currency/Price';
import { FrequentlyBoughtTogether } from '@/components/products/FrequentlyBoughtTogether';
import { ProductGalleryPro } from '@/components/products/ProductGalleryPro';
import { ProductPurchasePanel } from '@/components/products/ProductPurchasePanel';
import { ProductSpecs } from '@/components/products/ProductSpecs';
import { ProductTabs } from '@/components/products/ProductTabs';
import { ProductAuctionTeaser } from '@/components/products/ProductAuctionTeaser';
import { RelatedProducts } from '@/components/products/RelatedProducts';
import { StickyBuyBar } from '@/components/products/StickyBuyBar';
import { SupplierCard } from '@/components/products/SupplierCard';
import { ReviewsSection } from '@/components/reviews/ReviewsSection';
import {
  BreadcrumbJsonLd,
  ProductJsonLd,
  WebPageJsonLd,
  type ProductReviewLite
} from '@/components/seo/JsonLd';
import { getBaseUrl } from '@/lib/api/base-url';
import { getCurrentUser } from '@/lib/auth/session';
import { getSocialProof } from '@/lib/conversion/social-proof';
import {
  getProductRatingStats,
  listReviewsForProduct
} from '@/lib/reviews/service';
import { ViewRecorder, RecentlyViewedShelf } from '@/components/conversion/RecentlyViewed';
import {
  SITE_NAME,
  buildAlternates,
  buildLocaleUrl,
  composeTitle,
  toOgAlternateLocales,
  toOgLocale,
  truncateDescription
} from '@/lib/seo/site';
import { getWishlistProductIds } from '@/lib/wishlist/service';
import type { Product, ProductsResponse } from '@/types/product';

type PageParams = {
  params: Promise<{ locale: string; slug: string }>;
};

async function fetchProductBySlug(slug: string): Promise<Product | null> {
  try {
    const base = await getBaseUrl();
    const res = await fetch(
      `${base}/api/products?slug=${encodeURIComponent(slug)}&pageSize=1`,
      { cache: 'no-store' }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as ProductsResponse;
    return json.data?.[0] ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params
}: PageParams): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: 'products' });
  const product = await fetchProductBySlug(slug);

  if (!product) {
    return {
      title: composeTitle(t('notFoundTitle')),
      robots: { index: false, follow: false }
    };
  }

  const titleBase =
    product.metaTitle?.trim() ||
    (product.brand?.name
      ? `${product.title} — ${product.brand.name}`
      : product.title);

  const descSource =
    product.metaDescription?.trim() ||
    product.description?.trim() ||
    t('metaDescription');
  const description = truncateDescription(descSource);

  const path = `/products/${product.slug}`;
  const canonical = buildLocaleUrl(locale, path);
  const images = [
    ...(product.imageUrl ? [product.imageUrl] : []),
    ...((product.images ?? []) as string[])
  ].filter(Boolean);

  return {
    title: composeTitle(titleBase),
    description,
    alternates: buildAlternates(locale, path),
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title: titleBase,
      description,
      url: canonical,
      locale: toOgLocale(locale),
      alternateLocale: toOgAlternateLocales(locale),
      images: images.length > 0 ? images : undefined
    },
    twitter: {
      card: 'summary_large_image',
      title: titleBase,
      description,
      images: images.length > 0 ? images : undefined
    }
  };
}

/**
 * Storefront product detail page.
 *
 * Layout (desktop ≥ lg):
 *   ┌────────── breadcrumb ──────────┐
 *   │ gallery (7 cols) │ buy box (5) │  ← buy box is sticky
 *   └──────────────────┴─────────────┘
 *   tabs (description / specs / reviews)
 *   frequently bought together
 *   ┌── supplier card (4) │ related products (8) ──┐
 *
 * On mobile everything stacks. A `StickyBuyBar` slides up from the
 * bottom once the buy box scrolls out of view.
 *
 * All heavy lifting (recommendations, reviews, ratings, wishlist
 * lookup) runs in parallel before render. Tabs are client-only so we
 * keep one round trip for the whole page.
 */
export default async function ProductDetailPage({ params }: PageParams) {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: 'products' });
  const product = await fetchProductBySlug(slug);

  if (!product) notFound();

  const [currentUser, ratingStats, latestReviewsForJsonLd, socialProof] = await Promise.all([
    getCurrentUser(),
    getProductRatingStats(product.id).catch(() => ({ average: 0, count: 0 })),
    listReviewsForProduct(product.id)
      .then((rs) => rs.slice(0, 2))
      .catch(() => []),
    getSocialProof(product.id, product.createdAt).catch(() => null),
  ]);

  const reviewsLd: ProductReviewLite[] = latestReviewsForJsonLd.map((r) => ({
    author: r.user?.name ?? 'Verified buyer',
    rating: r.rating,
    body: r.comment,
    datePublished: r.createdAt.toISOString().slice(0, 10)
  }));

  const productUrl = buildLocaleUrl(locale, `/products/${product.slug}`);
  const wishlistIds = currentUser
    ? await getWishlistProductIds(currentUser.id)
    : new Set<string>();

  const breadcrumbItems = [
    { name: t('home'), path: '/' },
    { name: t('title'), path: '/products' },
    ...(product.category
      ? [
          {
            name: product.category.name,
            path: `/categories/${product.category.slug}`
          }
        ]
      : []),
    { name: product.title, path: `/products/${product.slug}` }
  ];

  const priceAmount =
    typeof product.price === 'number' ? product.price : Number(product.price);

  // Pre-render the price node on the server (so we can keep the
  // currency context server-only) and reuse the same node both inside
  // the buy box and the mobile sticky bar.
  const compareAtAmount =
    product.compareAtPrice != null ? Number(product.compareAtPrice) : null;

  const priceMain = (
    <Price
      amount={priceAmount}
      locale={locale}
      from={product.currency}
      className="text-4xl font-black leading-none text-slate-900"
    />
  );

  const compareAtPriceNode =
    compareAtAmount != null && compareAtAmount > priceAmount ? (
      <Price amount={compareAtAmount} locale={locale} from={product.currency} />
    ) : undefined;
  const priceCompact = (
    <Price
      amount={priceAmount}
      locale={locale}
      from={product.currency}
      className="text-base font-black text-orange-600"
    />
  );

  return (
    <div id="top" className="space-y-10 pb-24 lg:pb-10">
      <ProductJsonLd
        product={product}
        locale={locale}
        url={productUrl}
        rating={ratingStats}
        reviews={reviewsLd}
      />
      <WebPageJsonLd
        type="ProductPage"
        url={productUrl}
        name={product.title}
        description={(product.metaDescription ?? product.description ?? '').slice(0, 300)}
        locale={locale}
      />
      <BreadcrumbJsonLd locale={locale} items={breadcrumbItems} />

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="text-xs text-slate-500">
        <Link href={`/${locale}`} className="hover:text-slate-900">
          {t('home')}
        </Link>
        <span className="mx-2 text-slate-300">/</span>
        <Link href={`/${locale}/products`} className="hover:text-slate-900">
          {t('title')}
        </Link>
        {product.category && (
          <>
            <span className="mx-2 text-slate-300">/</span>
            <Link
              href={`/${locale}/categories/${product.category.slug}`}
              className="hover:text-slate-900"
            >
              {product.category.name}
            </Link>
          </>
        )}
        <span className="mx-2 text-slate-300">/</span>
        <span className="text-slate-700">{product.title}</span>
      </nav>

      {/* Hero — gallery + buy box */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-7">
          <ProductGalleryPro
            title={product.title}
            imageUrl={product.imageUrl}
            images={product.images}
          />
        </div>
        <div className="lg:col-span-5">
          <ProductPurchasePanel
            product={product}
            locale={locale}
            isAuthenticated={!!currentUser}
            inWishlist={wishlistIds.has(product.id)}
            rating={ratingStats}
            socialProof={socialProof ?? undefined}
            priceNode={priceMain}
            compareAtPriceNode={compareAtPriceNode}
          />
        </div>
      </div>

      {/* Tabs: description / specs / reviews */}
      <ProductTabs
        description={product.description ?? null}
        specifications={<ProductSpecs product={product} locale={locale} />}
        reviews={<ReviewsSection productId={product.id} locale={locale} />}
        reviewCount={ratingStats.count}
      />

      {/* Frequently bought together (server, hidden if not enough order data) */}
      <FrequentlyBoughtTogether productId={product.id} locale={locale} />

      {/* Supplier + related */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4">
          {product.supplier && (
            <SupplierCard supplier={product.supplier} locale={locale} />
          )}
        </div>
        <div className="space-y-8 lg:col-span-8">
          <RelatedProducts
            currentProductId={product.id}
            categoryId={product.category?.id ?? null}
            locale={locale}
          />
          <ProductAuctionTeaser
            categoryId={product.category?.id ?? null}
            supplierId={product.supplier?.id ?? null}
            locale={locale}
          />
        </div>
      </div>

      {/* Recently viewed (client — reads localStorage) */}
      <RecentlyViewedShelf currentSlug={product.slug} locale={locale} title="Recently Viewed" />

      {/* Record this view into localStorage */}
      <ViewRecorder
        entry={{
          slug: product.slug,
          title: product.title,
          imageUrl: product.imageUrl ?? null,
          price: priceAmount,
          currency: product.currency ?? 'AED',
        }}
      />

      {/* Mobile sticky CTA */}
      <StickyBuyBar
        productId={product.id}
        productSlug={product.slug}
        productTitle={product.title}
        imageUrl={product.imageUrl ?? null}
        priceNode={priceCompact}
        locale={locale}
        inStock={product.stock > 0}
      />
    </div>
  );
}
