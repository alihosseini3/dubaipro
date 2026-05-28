import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { EmptyState } from '@/components/products/EmptyState';
import { ProductGrid } from '@/components/products/ProductGrid';
import { BreadcrumbJsonLd } from '@/components/seo/JsonLd';
import { getBaseUrl } from '@/lib/api/base-url';
import { getCurrentUser } from '@/lib/auth/session';
import { getBrandBySlug } from '@/lib/brands/service';
import { getWishlistProductIds } from '@/lib/wishlist/service';
import {
  SITE_NAME,
  buildAlternates,
  composeTitle,
  toOgAlternateLocales,
  toOgLocale,
  truncateDescription
} from '@/lib/seo/site';
import type { ProductsResponse } from '@/types/product';

type PageParams = { params: Promise<{ locale: string; slug: string }> };

export const revalidate = 1800;

async function fetchBrandProducts(brandId: string) {
  try {
    const base = await getBaseUrl();
    const res = await fetch(
      `${base}/api/products?brandId=${encodeURIComponent(brandId)}&pageSize=48`,
      { cache: 'no-store' }
    );
    if (!res.ok) return [];
    const json = (await res.json()) as ProductsResponse;
    return Array.isArray(json.data) ? json.data : [];
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params
}: PageParams): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: 'brands' });
  const brand = await getBrandBySlug(slug);
  if (!brand) {
    return {
      title: composeTitle(t('notFoundTitle')),
      robots: { index: false, follow: false }
    };
  }
  const title = t('detailMetaTitle', { name: brand.name });
  const description = truncateDescription(
    t('detailMetaDescription', { name: brand.name, count: brand.productCount })
  );
  const path = `/brands/${brand.slug}`;
  return {
    title: composeTitle(title),
    description,
    alternates: buildAlternates(locale, path),
    // Avoid thin pages from being indexed when brand has no products.
    robots:
      brand.productCount === 0
        ? { index: false, follow: true }
        : { index: true, follow: true },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title,
      description,
      locale: toOgLocale(locale),
      alternateLocale: toOgAlternateLocales(locale)
    },
    twitter: { card: 'summary_large_image', title, description }
  };
}

export default async function BrandDetailPage({ params }: PageParams) {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: 'brands' });
  const brand = await getBrandBySlug(slug);
  if (!brand) notFound();

  const [products, user] = await Promise.all([
    fetchBrandProducts(brand.id),
    getCurrentUser()
  ]);
  const wishlistIds = user
    ? await getWishlistProductIds(user.id).catch(() => new Set<string>())
    : undefined;

  return (
    <section className="space-y-8">
      <BreadcrumbJsonLd
        locale={locale}
        items={[
          { name: t('home'), path: '/' },
          { name: t('title'), path: '/brands' },
          { name: brand.name, path: `/brands/${brand.slug}` }
        ]}
      />

      <nav className="text-xs text-slate-500">
        <Link href={`/${locale}`} className="hover:text-slate-900">
          {t('home')}
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/${locale}/brands`} className="hover:text-slate-900">
          {t('title')}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-slate-700">{brand.name}</span>
      </nav>

      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          {t('detailH1', { name: brand.name })}
        </h1>
        <p className="text-sm text-slate-500">
          {t('productCount', { count: brand.productCount })}
        </p>
        {/* Intro text — prevents thin-content classification.  */}
        <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
          {t('detailIntro', { name: brand.name })}
        </p>
      </header>

      {products.length === 0 ? (
        <EmptyState
          title={t('emptyDetailTitle')}
          description={t('emptyDetailDescription')}
        />
      ) : (
        <ProductGrid
          products={products}
          locale={locale}
          isAuthenticated={Boolean(user)}
          wishlistIds={wishlistIds}
        />
      )}
    </section>
  );
}
