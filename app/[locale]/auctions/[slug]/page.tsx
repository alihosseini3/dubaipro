import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { AuctionBottomShowcase } from '@/components/auctions/AuctionBottomShowcase';
import { AuctionGallery }       from '@/components/auctions/AuctionGallery';
import { AuctionExperienceSections } from '@/components/auctions/AuctionExperienceSections';
import { AuctionHero }          from '@/components/auctions/AuctionHero';
import { AuctionTradingWorkspace } from '@/components/auctions/AuctionTradingWorkspace';
import { LiveBidPanel }         from '@/components/auctions/LiveBidPanel';
import { ShareButton }          from '@/components/auctions/ShareButton';
import { StickyBidBar }         from '@/components/auctions/StickyBidBar';
import { WatchButton }          from '@/components/auctions/WatchButton';
import { BreadcrumbJsonLd, JsonLd } from '@/components/seo/JsonLd';

import {
  getAuctionBySlug,
  incrementViews,
  isWatching,
  listLiveAuctions,
  listRelatedAuctions,
} from '@/lib/auctions/service';
import { getCurrentUser } from '@/lib/auth/session';
import { localizeArray, localizeRecord } from '@/lib/i18n/localize';
import {
  buildAlternates,
  buildLocaleUrl,
  composeTitle,
  toOgAlternateLocales,
  toOgLocale,
  truncateDescription,
} from '@/lib/seo/site';

type PageParams = { params: Promise<{ locale: string; slug: string }> };

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: 'auctions' });
  const auction = await getAuctionBySlug(slug);
  if (!auction) return { title: composeTitle(t('breadcrumb')), robots: { index: false, follow: false } };

  const description = truncateDescription(
    auction.description || `${auction.title} — ${auction.currentBid} ${auction.currency}`
  );
  const path = `/auctions/${slug}`;
  const canonical = buildLocaleUrl(locale, path);
  const images = [
    ...(auction.imageUrl ? [auction.imageUrl] : []),
    ...auction.images.map((img) => img.imageUrl),
  ];

  return {
    title:    composeTitle(auction.title),
    description,
    alternates: buildAlternates(locale, path),
    openGraph: {
      type: 'website',
      title: auction.title,
      description,
      url: canonical,
      images: images.length > 0 ? images : undefined,
      locale: toOgLocale(locale),
      alternateLocale: toOgAlternateLocales(locale),
    },
    twitter: {
      card: 'summary_large_image',
      title: auction.title,
      description,
      images: images.length > 0 ? images : undefined,
    },
  };
}

export default async function AuctionDetailPage({ params }: PageParams) {
  const { locale, slug } = await params;
  const t   = await getTranslations({ locale, namespace: 'auctions' });
  const td  = await getTranslations({ locale, namespace: 'auctions.detail' });
  const tnv = await getTranslations({ locale, namespace: 'navbar' });

  const [rawAuction, user] = await Promise.all([
    getAuctionBySlug(slug),
    getCurrentUser(),
  ]);
  if (!rawAuction) notFound();

  const auction = await localizeRecord(rawAuction, locale, [
    'title',
    'description',
    'supplierName',
    'categoryName',
  ]);

  /* Non-blocking view increment + parallel related auctions fetch. */
  incrementViews(rawAuction.id);
  const [watching, rawRelated, rawSupplierAuctions, rawTrending] = await Promise.all([
    user ? isWatching(rawAuction.id, user.id) : Promise.resolve(false),
    listRelatedAuctions({
      excludeId: rawAuction.id,
      categoryId: rawAuction.categoryId,
      supplierId: rawAuction.supplierId,
      limit: 8,
    }),
    listRelatedAuctions({
      excludeId: rawAuction.id,
      categoryId: null,
      supplierId: rawAuction.supplierId,
      limit: 8,
    }),
    listLiveAuctions(8),
  ]);
  const related = await localizeArray(rawRelated, locale, ['title', 'supplierName']);
  const supplierAuctions = await localizeArray(rawSupplierAuctions, locale, ['title', 'supplierName']);
  const trending = await localizeArray(
    rawTrending.filter((item) => item.id !== rawAuction.id),
    locale,
    ['title', 'supplierName']
  );

  const base = `/${locale}`;
  const loginHref = `${base}/login?redirect=${encodeURIComponent(`/auctions/${slug}`)}`;
  const url = buildLocaleUrl(locale, `/auctions/${slug}`);

  /* Build gallery: hero image + extra images. */
  const galleryUrls = auction.images.map((img) => img.imageUrl);

  /* Breadcrumb data for JSON-LD + nav */
  const breadcrumbs = [
    { name: tnv('home'),    path: '/' },
    { name: t('breadcrumb'), path: '/auctions' },
    ...(auction.categoryName && auction.categorySlug
      ? [{ name: auction.categoryName, path: `/categories/${auction.categorySlug}` }]
      : []),
    { name: auction.title, path: `/auctions/${slug}` },
  ];

  /* Schema.org structured data — Product+Offer hybrid for auctions. */
  const productLd = {
    '@context': 'https://schema.org',
    '@type':    'Product',
    name:        auction.title,
    description: auction.description,
    image:       galleryUrls.length > 0 ? galleryUrls : auction.imageUrl ? [auction.imageUrl] : undefined,
    sku:         auction.id,
    ...(auction.supplierName && {
      brand: { '@type': 'Brand', name: auction.supplierName },
    }),
    offers: {
      '@type':         'Offer',
      url,
      priceCurrency:   auction.currency,
      price:           auction.currentBid > 0 ? auction.currentBid : auction.startingBid,
      availability:    auction.status === 'LIVE'
        ? 'https://schema.org/InStock'
        : auction.status === 'ENDED'
          ? 'https://schema.org/SoldOut'
          : 'https://schema.org/PreOrder',
      validFrom:  auction.startsAt,
      priceValidUntil: auction.endsAt,
    },
  };

  const supplierHref = auction.supplierId ? `${base}/suppliers/${auction.supplierId}` : undefined;

  return (
    <article className="bg-[#F5F7FB] pb-32 text-[15px] sm:text-base lg:pb-10">
      <JsonLd data={productLd} />
      <BreadcrumbJsonLd locale={locale} items={breadcrumbs} />

      <div className="mx-auto max-w-[1600px] px-3 py-4 sm:px-4 lg:px-6">
        <AuctionHero
          auction={auction}
          locale={locale}
          base={base}
          supplierHref={supplierHref}
          statusLabel={t(`status.${auction.status}` as 'status.LIVE')}
          breadcrumbHref={tnv('home')}
        />

        {/* Top Section: Media & Bidding */}
        <div className="grid items-start gap-5 lg:grid-cols-12" dir="ltr">
          <div className="min-w-0 lg:col-span-7 xl:col-span-8">
            <AuctionGallery
              title={auction.title}
              imageUrl={auction.imageUrl}
              images={galleryUrls}
              actions={
                <>
                  <WatchButton
                    auctionId={auction.id}
                    initialWatching={watching}
                    initialCount={auction.watcherCount}
                    loggedIn={!!user}
                    loginHref={loginHref}
                    variant="gallery"
                  />
                  <ShareButton title={auction.title} url={url} variant="gallery" />
                </>
              }
            />
          </div>

          <div className="min-w-0 lg:col-span-5 xl:col-span-4">
            <div id="bid-form">
              <LiveBidPanel
                auction={auction}
                loggedIn={!!user}
                initialWatching={watching}
                locale={locale}
                loginHref={loginHref}
                supplierHref={supplierHref}
              />
            </div>
          </div>
        </div>

        {/* Middle Section: Trading Workspace */}
        <div className="mt-5 grid items-stretch gap-5 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)] xl:grid-cols-[minmax(0,1.18fr)_minmax(0,0.82fr)]" dir="ltr">
          <div className="min-w-0 h-full lg:h-[260px]">
            <AuctionTradingWorkspace auction={auction} locale={locale} mode="chart" />
          </div>
          <div className="min-w-0 h-full lg:h-[260px]">
            <AuctionTradingWorkspace auction={auction} locale={locale} mode="history" />
          </div>
        </div>

        {/* Bottom Section: Description */}
        {auction.description && (
          <div className="mt-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
            <h2 className="mb-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
              {td('aboutLot')}
            </h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
              {auction.description}
            </p>
          </div>
        )}

        <AuctionExperienceSections
          auction={auction}
          locale={locale}
          loggedIn={!!user}
          loginHref={loginHref}
          related={related}
          supplierAuctions={supplierAuctions}
          trending={trending}
        />

        <AuctionBottomShowcase
          auctionId={auction.id}
          categoryId={auction.categoryId ?? null}
          locale={locale}
        />
      </div>

      {/* Mobile sticky bid bar */}
      <StickyBidBar
        auctionId={auction.id}
        status={auction.status}
        initialBid={auction.currentBid}
        startingBid={auction.startingBid}
        initialEndsAt={auction.endsAt}
        currency={auction.currency}
        locale={locale}
      />
    </article>
  );
}

