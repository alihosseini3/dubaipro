import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { prisma } from '@/lib/prisma';
import { PUBLIC_PRODUCT_WHERE } from '@/lib/products/visibility';
import { listLiveAuctions, listRelatedAuctions } from '@/lib/auctions/service';
import type { AuctionDTO } from '@/lib/auctions/service';
import { localizeArray } from '@/lib/i18n/localize';

type TFn = (key: string, values?: Record<string, string | number>) => string;

type Props = {
  auctionId: string;
  categoryId: string | null;
  locale: string;
};

type ProductCard = {
  id: string;
  slug: string;
  title: string;
  imageUrl: string | null;
  price: number;
  compareAtPrice: number | null;
  currency: string;
  supplierName?: string | null;
};

function money(amount: number, currency: string, locale: string) {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

/**
 * Three-row showcase rendered at the bottom of an auction detail page:
 *
 *   1. **More auctions** — live/scheduled auctions, prioritised by the
 *      current auction's category, with cross-category fallback.
 *   2. **Products in this category** — regular storefront products from
 *      the same category, with site-wide fallback.
 *   3. **Best sellers** — site-wide best-selling products, ranked by the
 *      total quantity sold from `OrderItem` aggregates.
 *
 * Always tries to render at least 6 items per row when data exists. If a
 * row ends up empty (eg. fresh database) we hide it instead of showing an
 * empty card.
 */
export async function AuctionBottomShowcase({ auctionId, categoryId, locale }: Props) {
  const t = await getTranslations({ locale, namespace: 'auctions.detail' });
  const base = `/${locale}`;

  /* ── 1) More auctions: same category first, then global ── */
  const sameCatAuctions = categoryId
    ? await listRelatedAuctions({
        excludeId: auctionId,
        categoryId,
        supplierId: null,
        limit: 12,
      })
    : [];

  let auctionList = sameCatAuctions.slice(0, 12);
  if (auctionList.length < 6) {
    const fallback = await listLiveAuctions(12);
    const seen = new Set<string>([auctionId, ...auctionList.map((a) => a.id)]);
    for (const a of fallback) {
      if (auctionList.length >= 12) break;
      if (seen.has(a.id)) continue;
      auctionList.push(a);
      seen.add(a.id);
    }
  }
  auctionList = await localizeArray(auctionList, locale, ['title', 'supplierName']);

  /* ── 2) Products in same category ── */
  const productSelect = {
    id: true,
    slug: true,
    title: true,
    imageUrl: true,
    price: true,
    compareAtPrice: true,
    currency: true,
    supplier: { select: { name: true } },
  } as const;

  const sameCatProductsRaw = categoryId
    ? await prisma.product.findMany({
        where: { ...PUBLIC_PRODUCT_WHERE, categoryId },
        orderBy: { createdAt: 'desc' },
        take: 12,
        select: productSelect,
      })
    : [];

  let productRows = sameCatProductsRaw;
  if (productRows.length < 6) {
    const more = await prisma.product.findMany({
      where: { ...PUBLIC_PRODUCT_WHERE, id: { notIn: productRows.map((p) => p.id) } },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: productSelect,
    });
    productRows = [...productRows, ...more].slice(0, 12);
  }

  const products: ProductCard[] = productRows.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    imageUrl: p.imageUrl,
    price: Number(p.price),
    compareAtPrice: p.compareAtPrice ? Number(p.compareAtPrice) : null,
    currency: p.currency,
    supplierName: p.supplier?.name ?? null,
  }));

  /* ── 3) Best sellers — group by orderItem, fallback to recent ── */
  const grouped = await prisma.orderItem
    .groupBy({
      by: ['productId'],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 18,
    })
    .catch(() => [] as Array<{ productId: string; _sum: { quantity: number | null } }>);

  const bestIds = grouped.map((g) => g.productId);
  let bestSellersRaw: typeof productRows = [];
  if (bestIds.length > 0) {
    const rows = await prisma.product.findMany({
      where: { ...PUBLIC_PRODUCT_WHERE, id: { in: bestIds } },
      select: productSelect,
    });
    /* preserve groupBy order */
    const map = new Map(rows.map((r) => [r.id, r]));
    bestSellersRaw = bestIds.map((id) => map.get(id)).filter(Boolean) as typeof productRows;
  }
  if (bestSellersRaw.length < 6) {
    const filler = await prisma.product.findMany({
      where: { ...PUBLIC_PRODUCT_WHERE, id: { notIn: bestSellersRaw.map((p) => p.id) } },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: productSelect,
    });
    bestSellersRaw = [...bestSellersRaw, ...filler].slice(0, 12);
  }
  const bestSellers: ProductCard[] = bestSellersRaw.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    imageUrl: p.imageUrl,
    price: Number(p.price),
    compareAtPrice: p.compareAtPrice ? Number(p.compareAtPrice) : null,
    currency: p.currency,
    supplierName: p.supplier?.name ?? null,
  }));

  return (
    <div className="mt-6 space-y-5">
      {auctionList.length > 0 && (
        <AuctionsBox
          locale={locale}
          base={base}
          auctions={auctionList}
          title={t('moreAuctions')}
          subtitle={t('moreAuctionsSubtitle')}
          t={t}
        />
      )}
      {products.length > 0 && (
        <ProductsBox
          locale={locale}
          base={base}
          products={products}
          title={t('relatedProducts')}
          subtitle={t('relatedProductsSubtitle')}
          accent="orange"
          t={t}
        />
      )}
      {bestSellers.length > 0 && (
        <ProductsBox
          locale={locale}
          base={base}
          products={bestSellers}
          title={t('bestSellers')}
          subtitle={t('bestSellersSubtitle')}
          accent="emerald"
          ribbon={t('topSeller')}
          t={t}
        />
      )}
    </div>
  );
}

/* ─── Auction box ─────────────────────────────────────────────── */

function AuctionsBox({
  auctions,
  locale,
  base,
  title,
  subtitle,
  t,
}: {
  auctions: AuctionDTO[];
  locale: string;
  base: string;
  title: string;
  subtitle: string;
  t: TFn;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-500">{subtitle}</p>
          <h2 className="mt-1 text-base font-black tracking-tight text-[#0F172A] sm:text-lg">{title}</h2>
        </div>
        <Link href={`${base}/auctions`} className="shrink-0 text-[11px] font-bold text-[#F97316] hover:underline">
          {t('viewAllLink')} →
        </Link>
      </header>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {auctions.slice(0, 6).map((a) => {
          const display = a.currentBid > 0 ? a.currentBid : a.startingBid;
          return (
            <li key={a.id}>
              <Link
                href={`${base}/auctions/${a.slug}`}
                className="group block overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-lg"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
                  {a.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={a.imageUrl}
                      alt={a.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-300 text-xs">{t('noImage')}</div>
                  )}
                  {a.status === 'LIVE' && (
                    <span className="absolute start-2 top-2 inline-flex items-center gap-1 rounded-md bg-emerald-500 px-1.5 py-0.5 text-[9px] font-black uppercase text-white shadow">
                      <span className="h-1 w-1 animate-pulse rounded-full bg-white" /> LIVE
                    </span>
                  )}
                  {(a.bidCount >= 5 || a.watcherCount >= 10) && (
                    <span className="absolute end-2 top-2 rounded-md bg-rose-500 px-1.5 py-0.5 text-[9px] font-black uppercase text-white shadow">Hot</span>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="line-clamp-2 min-h-[34px] text-xs font-bold text-[#0F172A] group-hover:text-[#F97316]">
                    {a.title}
                  </h3>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('currentBidLabel')}</p>
                  <p className="text-sm font-black tabular-nums text-[#F97316]">
                    {money(display, a.currency, locale)}
                  </p>
                  <p className="mt-1 truncate text-[10px] text-slate-500">
                    {t('bidsWatching', { bids: a.bidCount, watching: a.watcherCount })}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ─── Products box ─────────────────────────────────────────────── */

function ProductsBox({
  products,
  locale,
  base,
  title,
  subtitle,
  accent,
  ribbon,
  t,
}: {
  products: ProductCard[];
  locale: string;
  base: string;
  title: string;
  subtitle: string;
  accent: 'orange' | 'emerald';
  ribbon?: string;
  t: TFn;
}) {
  const accentText = accent === 'emerald' ? 'text-emerald-600' : 'text-orange-500';
  const priceColor = accent === 'emerald' ? 'text-emerald-600' : 'text-[#F97316]';
  const ribbonBg = accent === 'emerald' ? 'bg-emerald-500' : 'bg-rose-500';

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className={`text-[10px] font-black uppercase tracking-[0.22em] ${accentText}`}>{subtitle}</p>
          <h2 className="mt-1 text-base font-black tracking-tight text-[#0F172A] sm:text-lg">{title}</h2>
        </div>
        <Link href={`${base}/products`} className={`shrink-0 text-[11px] font-bold ${accentText} hover:underline`}>
          {t('viewAllLink')} →
        </Link>
      </header>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {products.slice(0, 6).map((p) => {
          const discount = p.compareAtPrice && p.compareAtPrice > p.price
            ? Math.round(((p.compareAtPrice - p.price) / p.compareAtPrice) * 100)
            : 0;
          return (
            <li key={p.id}>
              <Link
                href={`${base}/products/${p.slug}`}
                className="group block overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg"
              >
                <div className="relative aspect-square w-full overflow-hidden bg-slate-50">
                  {p.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={p.imageUrl}
                      alt={p.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-300 text-xs">{t('noImage')}</div>
                  )}
                  {ribbon && (
                    <span className={`absolute start-2 top-2 rounded-md ${ribbonBg} px-1.5 py-0.5 text-[9px] font-black uppercase text-white shadow`}>
                      {ribbon}
                    </span>
                  )}
                  {discount > 0 && (
                    <span className="absolute end-2 top-2 rounded-md bg-orange-500 px-1.5 py-0.5 text-[9px] font-black uppercase text-white shadow">
                      −{discount}%
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="line-clamp-2 min-h-[34px] text-xs font-bold text-[#0F172A] group-hover:text-[#F97316]">
                    {p.title}
                  </h3>
                  <p className={`mt-2 text-sm font-black tabular-nums ${priceColor}`}>
                    {money(p.price, p.currency, locale)}
                  </p>
                  {p.compareAtPrice && p.compareAtPrice > p.price && (
                    <p className="text-[10px] text-slate-400 line-through tabular-nums">
                      {money(p.compareAtPrice, p.currency, locale)}
                    </p>
                  )}
                  {p.supplierName && (
                    <p className="mt-1 truncate text-[10px] text-slate-500">{p.supplierName}</p>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
