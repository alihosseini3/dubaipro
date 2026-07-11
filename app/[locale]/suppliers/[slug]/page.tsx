import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { ProductGrid } from '@/components/products/ProductGrid';
import { BreadcrumbJsonLd, JsonLd } from '@/components/seo/JsonLd';
import { SupplierAboutPanel } from '@/components/suppliers/SupplierAboutPanel';
import { SupplierCertificationGallery } from '@/components/suppliers/SupplierCertificationGallery';
import { SupplierHero } from '@/components/suppliers/SupplierHero';
import { SupplierReviewForm } from '@/components/suppliers/SupplierReviewForm';
import { SupplierReviewList } from '@/components/suppliers/SupplierReviewList';
import { SupplierTabs } from '@/components/suppliers/SupplierTabs';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { PUBLIC_PRODUCT_WHERE } from '@/lib/products/visibility';
import {
  getPublicSupplierBySlug,
  isFollowing,
  listSupplierCertifications
} from '@/lib/suppliers';
import {
  SITE_NAME,
  buildAlternates,
  composeTitle,
  getSiteUrl,
  toOgAlternateLocales,
  toOgLocale,
  truncateDescription
} from '@/lib/seo/site';
import { getWishlistProductIds } from '@/lib/wishlist/service';

type PageParams = { params: Promise<{ locale: string; slug: string }> };

export const revalidate = 120;

export async function generateMetadata({
  params
}: PageParams): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: 'suppliers' });
  const supplier = await getPublicSupplierBySlug(slug, locale);
  if (!supplier) {
    return {
      title: composeTitle(t('notFoundTitle')),
      robots: { index: false, follow: false }
    };
  }
  const title = supplier.metaTitle || `${supplier.name} — ${supplier.country}`;
  const description = truncateDescription(
    supplier.metaDescription ||
      supplier.shortTagline ||
      supplier.description ||
      t('metaDescription')
  );
  const path = `/suppliers/${supplier.slug}`;
  return {
    title: composeTitle(title),
    description,
    alternates: buildAlternates(locale, path),
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title,
      description,
      images: supplier.bannerUrl ? [{ url: supplier.bannerUrl }] : undefined,
      locale: toOgLocale(locale),
      alternateLocale: toOgAlternateLocales(locale)
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: supplier.bannerUrl ? [supplier.bannerUrl] : undefined
    }
  };
}

export default async function SupplierProfilePage({ params }: PageParams) {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: 'suppliers' });
  const supplier = await getPublicSupplierBySlug(slug, locale);
  if (!supplier) notFound();

  const user = await getCurrentUser();

  const [
    products,
    auctions,
    reviewsResp,
    certifications,
    initialFollowing,
    wishlistIds,
    viewerReview
  ] = await Promise.all([
    prisma.product.findMany({
      where: { ...PUBLIC_PRODUCT_WHERE, supplierId: supplier.id },
      orderBy: { createdAt: 'desc' },
      take: 24,
      select: {
        id: true,
        title: true,
        slug: true,
        price: true,
        compareAtPrice: true,
        currency: true,
        stock: true,
        isB2B: true,
        imageUrl: true,
        images: true,
        category: { select: { id: true, name: true, slug: true } },
        brand: { select: { id: true, name: true, slug: true } }
      }
    }),
    prisma.auction.findMany({
      where: {
        supplierId: supplier.id,
        status: { in: ['LIVE', 'SCHEDULED'] }
      },
      orderBy: { endsAt: 'asc' },
      take: 12,
      select: {
        id: true,
        slug: true,
        title: true,
        imageUrl: true,
        currentBid: true,
        startingBid: true,
        currency: true,
        endsAt: true,
        status: true
      }
    }),
    fetchReviewsBundle(supplier.id),
    listSupplierCertifications(supplier.id, { onlyApproved: true }),
    user ? isFollowing(supplier.id, user.id) : Promise.resolve(false),
    user
      ? getWishlistProductIds(user.id).catch(() => new Set<string>())
      : Promise.resolve(undefined),
    user
      ? prisma.supplierReview.findUnique({
          where: {
            supplierId_userId: { supplierId: supplier.id, userId: user.id }
          },
          select: { id: true }
        })
      : Promise.resolve(null)
  ]);

  const tabs = [
    {
      key: 'products',
      label: t('tabs.products'),
      count: products.length,
      // ProductGrid expects the canonical Product DTO; the projection
      // above intentionally matches `@/types/product`.
      content: products.length === 0 ? (
        <p className="text-sm text-slate-500">{t('products.empty')}</p>
      ) : (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <ProductGrid
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          products={products as any}
          locale={locale}
          isAuthenticated={Boolean(user)}
          wishlistIds={wishlistIds}
        />
      )
    },
    {
      key: 'auctions',
      label: t('tabs.auctions'),
      count: auctions.length,
      content:
        auctions.length === 0 ? (
          <p className="text-sm text-slate-500">{t('auctions.empty')}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {auctions.map((a) => (
              <li
                key={a.id}
                className="rounded-xl border border-slate-200 bg-white p-3"
              >
                <Link href={`/${locale}/auctions/${a.slug ?? a.id}`}>
                  <h3 className="line-clamp-2 text-sm font-semibold text-slate-900">
                    {a.title}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {a.status === 'LIVE' ? t('auctions.live') : t('auctions.scheduled')}
                    {' · '}
                    {a.currency} {String(a.currentBid ?? a.startingBid)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )
    },
    {
      key: 'reviews',
      label: t('tabs.reviews'),
      count: reviewsResp.stats.ratingCount,
      content: (
        <SupplierReviewList
          reviews={reviewsResp.reviews}
          stats={reviewsResp.stats}
          locale={locale}
          formSlot={
            user ? (
              viewerReview ? (
                <p className="rounded-md bg-slate-50 p-3 text-xs text-slate-500">
                  {t('reviews.alreadyReviewed')}
                </p>
              ) : (
                <SupplierReviewForm supplierSlug={supplier.slug} />
              )
            ) : (
              <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">
                <Link
                  href={`/${locale}/login?returnTo=/${locale}/suppliers/${supplier.slug}`}
                  className="font-medium text-slate-900 underline"
                >
                  {t('loginToReview')}
                </Link>
              </p>
            )
          }
          emptyAfterForm
        />
      )
    },
    {
      key: 'about',
      label: t('tabs.about'),
      content: <SupplierAboutPanel supplier={supplier} />
    },
    {
      key: 'certifications',
      label: t('tabs.certifications'),
      count: certifications.length,
      content: (
        <SupplierCertificationGallery
          items={certifications.map((c) => ({
            id: c.id,
            type: c.type,
            title: c.title,
            issuer: c.issuer,
            fileUrl: c.fileUrl,
            thumbUrl: c.thumbUrl,
            issuedAt: c.issuedAt,
            expiresAt: c.expiresAt
          }))}
          locale={locale}
        />
      )
    }
  ];

  const baseUrl = getSiteUrl();
  const profileUrl = `${baseUrl}/${locale}/suppliers/${supplier.slug}`;

  return (
    <section className="space-y-6">
      <BreadcrumbJsonLd
        locale={locale}
        items={[
          { name: t('home'), path: '/' },
          { name: t('title'), path: '/suppliers' },
          { name: supplier.name, path: `/suppliers/${supplier.slug}` }
        ]}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: supplier.name,
          url: profileUrl,
          logo: supplier.logoUrl ?? undefined,
          image: supplier.bannerUrl ?? undefined,
          description:
            supplier.shortTagline ?? supplier.description ?? undefined,
          address: {
            '@type': 'PostalAddress',
            addressLocality: supplier.city ?? undefined,
            addressCountry: supplier.country
          },
          aggregateRating:
            supplier.ratingCount > 0
              ? {
                  '@type': 'AggregateRating',
                  ratingValue: supplier.ratingAvg,
                  reviewCount: supplier.ratingCount
                }
              : undefined
        }}
      />

      <SupplierHero
        supplier={supplier}
        locale={locale}
        isAuthenticated={Boolean(user)}
        initialFollowing={initialFollowing}
      />

      <SupplierTabs tabs={tabs} defaultKey="products" />
    </section>
  );
}

async function fetchReviewsBundle(supplierId: string) {
  const [reviews, breakdown, supplierMeta] = await Promise.all([
    prisma.supplierReview.findMany({
      where: { supplierId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        rating: true,
        title: true,
        comment: true,
        isVerifiedPurchase: true,
        supplierReplyContent: true,
        supplierReplyAt: true,
        createdAt: true,
        user: { select: { id: true, name: true } }
      }
    }),
    prisma.supplierReview.groupBy({
      by: ['rating'],
      where: { supplierId },
      _count: { _all: true }
    }),
    prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { ratingAvg: true, ratingCount: true }
    })
  ]);

  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const b of breakdown) counts[b.rating] = b._count._all;

  return {
    reviews: reviews.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      supplierReplyAt: r.supplierReplyAt?.toISOString() ?? null
    })),
    stats: {
      ratingAvg: supplierMeta?.ratingAvg ?? 0,
      ratingCount: supplierMeta?.ratingCount ?? 0,
      breakdown: counts
    }
  };
}
