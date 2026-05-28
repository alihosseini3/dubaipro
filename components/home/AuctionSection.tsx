import Link from 'next/link';

import { Price } from '@/components/currency/Price';
import { listLiveAuctions } from '@/lib/auctions/service';
import type { HomepageSectionDTO } from '@/lib/homepage/types';
import { localizeArray } from '@/lib/i18n/localize';

import { AuctionCountdown } from './AuctionCountdown';
import { SectionHeader } from './CategoriesSection';
import { ArrowRightIcon, HammerIcon } from './icons';

type Props = { locale: string; section: HomepageSectionDTO };

type ConfigItem = {
  title: string;
  imageUrl?: string;
  currentBid: number;
  currency?: string;
  endsAt?: string;
  href?: string;
};

type RenderItem = {
  key: string;
  title: string;
  imageUrl?: string | null;
  currentBid: number;
  currency: string;
  endsAt?: string;
  href?: string;
};

/**
 * Live-auction band. Source order:
 *
 *   1. Real `Auction` rows (LIVE + SCHEDULED) sorted by `endsAt` —
 *      this is the production path now that the Auction model exists.
 *   2. `config.items` legacy fallback — admins who set up auction
 *      cards before the real model shipped don't lose them.
 *   3. Empty teaser when both sources are empty.
 */
export async function AuctionSection({ locale, section }: Props) {
  const liveRaw = await listLiveAuctions(8);
  // Translate the lot title (and any future text fields) before
  // building the render shape. Auctions live across multiple
  // locales, so this keeps card copy consistent with the rest of the
  // homepage.
  const live = await localizeArray(liveRaw, locale, ['title']);

  const configItems: RenderItem[] = (
    (section.config.items as ConfigItem[] | undefined) ?? []
  )
    .filter(
      (x) => x && typeof x.title === 'string' && typeof x.currentBid === 'number'
    )
    .map((x, i) => ({
      key: `cfg-${i}`,
      title: x.title,
      imageUrl: x.imageUrl ?? null,
      currentBid: x.currentBid,
      currency: x.currency ?? 'AED',
      endsAt: x.endsAt,
      href: x.href
    }));

  const base = `/${locale}`;
  const ctaHref = withLocale(base, section.ctaHref);

  const items: RenderItem[] =
    live.length > 0
      ? live.map((a) => ({
          key: a.id,
          title: a.title,
          imageUrl: a.imageUrl,
          currentBid: a.currentBid > 0 ? a.currentBid : a.startingBid,
          currency: a.currency,
          endsAt: a.endsAt,
          href: `/auctions/${a.slug}`
        }))
      : configItems;

  return (
    <section aria-labelledby="home-auctions" className="space-y-6">
      <SectionHeader
        id="home-auctions"
        title={section.title}
        subtitle={section.subtitle}
        ctaLabel={section.ctaLabel}
        ctaHref={ctaHref}
      />

      {items.length === 0 ? (
        <EmptyTeaser ctaHref={ctaHref} ctaLabel={section.ctaLabel} />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => {
            const href = withLocale(base, item.href ?? null);
            return (
              <li key={item.key}>
                {href ? (
                  <Link
                    href={href}
                    className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-lg"
                  >
                    <AuctionCardBody item={item} locale={locale} />
                  </Link>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <AuctionCardBody item={item} locale={locale} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function AuctionCardBody({
  item,
  locale
}: {
  item: RenderItem;
  locale: string;
}) {
  return (
    <>
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300">
            <HammerIcon className="h-12 w-12" />
          </div>
        )}
        {item.endsAt && (
          <div className="absolute end-2 top-2">
            <AuctionCountdown endsAt={item.endsAt} />
          </div>
        )}
      </div>
      <div className="space-y-2 p-4">
        <h3 className="line-clamp-2 min-h-[40px] text-sm font-semibold leading-tight text-slate-900 transition group-hover:text-orange-700">
          {item.title}
        </h3>
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Current bid
          </span>
          <Price
            amount={Number(item.currentBid) || 0}
            locale={locale}
            from={item.currency}
            className="text-base font-black text-orange-600"
          />
        </div>
      </div>
    </>
  );
}

function EmptyTeaser({
  ctaHref,
  ctaLabel
}: {
  ctaHref: string | null;
  ctaLabel: string | null;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-dashed border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50 p-8 text-center sm:p-12">
      <div className="mx-auto flex max-w-md flex-col items-center gap-4">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-md">
          <HammerIcon className="h-7 w-7" />
        </span>
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            New batches every Friday
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            We add overstock and end-of-line lots from Dubai warehouses every
            week. Check back soon or get notified by email.
          </p>
        </div>
        {ctaHref && ctaLabel && (
          <Link
            href={ctaHref}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-orange-600 hover:shadow-md"
          >
            {ctaLabel}
            <ArrowRightIcon className="h-4 w-4 rtl:-scale-x-100" />
          </Link>
        )}
      </div>
    </div>
  );
}

function withLocale(base: string, href: string | null): string | null {
  if (!href) return null;
  if (href.startsWith('http')) return href;
  return `${base}${href.startsWith('/') ? href : `/${href}`}`;
}
