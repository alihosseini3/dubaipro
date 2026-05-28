import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { BidsBoard } from '@/components/auctions/BidsBoard';
import { listAuctionBidsBySlug } from '@/lib/auctions/service';
import { getCurrentUser } from '@/lib/auth/session';
import { localizeRecord } from '@/lib/i18n/localize';
import { buildAlternates, buildLocaleUrl, composeTitle } from '@/lib/seo/site';

type PageParams = { params: Promise<{ locale: string; slug: string }> };

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: 'auctions.bidsPage' });
  const result = await listAuctionBidsBySlug(slug);
  if (!result) {
    return { title: composeTitle(t('metaTitleFallback')), robots: { index: false, follow: false } };
  }
  const path = `/auctions/${slug}/bids`;
  return {
    title: composeTitle(t('metaTitle', { title: result.auction.title })),
    description: t('metaDescription', { title: result.auction.title }),
    alternates: buildAlternates(locale, path),
    openGraph: {
      type: 'website',
      title: t('metaTitle', { title: result.auction.title }),
      description: t('metaDescription', { title: result.auction.title }),
      url: buildLocaleUrl(locale, path),
    },
    robots: { index: false, follow: true },
  };
}

export default async function AuctionBidsPage({ params }: PageParams) {
  const { locale, slug } = await params;

  const [result, user] = await Promise.all([
    listAuctionBidsBySlug(slug),
    getCurrentUser(),
  ]);
  if (!result) notFound();

  const auction = await localizeRecord(result.auction, locale, ['title', 'description']);
  const loginHref = `/${locale}/login?redirect=${encodeURIComponent(`/auctions/${slug}/bids`)}`;

  return (
    <BidsBoard
      auction={auction}
      initialBids={result.bids}
      locale={locale}
      loggedIn={!!user}
      loginHref={loginHref}
    />
  );
}
