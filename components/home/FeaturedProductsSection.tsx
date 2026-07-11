import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { Price } from '@/components/currency/Price';
import type { HomepageSectionDTO } from '@/lib/homepage/types';
import { localizeArray } from '@/lib/i18n/localize';
import { prisma } from '@/lib/prisma';
import { PUBLIC_PRODUCT_WHERE } from '@/lib/products/visibility';

import { SectionHeader } from './CategoriesSection';

type Props = { locale: string; section: HomepageSectionDTO };

/**
 * Featured products grid — 4–16 product cards.
 *
 * Source order:
 *   1. `config.productIds` (admin curated). Missing IDs (deleted /
 *      hidden products) are skipped silently.
 *   2. Otherwise, the most-recent products. Cheap because the
 *      `createdAt` index is already there.
 *
 * The card is B2B-first: image, title, supplier, the LOWEST volume-tier
 * price (rendered as "from X" when tiers exist) and the MOQ line — the two
 * numbers a wholesale buyer scans for. Prices localize through the existing
 * <Price> server component. No client JS — clicks navigate to the PDP.
 */
export async function FeaturedProductsSection({ locale, section }: Props) {
  const t = await getTranslations({ locale, namespace: 'home.cards' });
  const cfgIds = (section.config.productIds as string[] | undefined) ?? [];
  const limit = clamp(
    (section.config.limit as number | undefined) ?? 8,
    4,
    16
  );

  const rawProducts = await loadProducts(cfgIds, limit);
  if (rawProducts.length === 0) return null;
  // Translate user-facing product strings. Supplier name is translated
  // too so brand-style names like "Al-Falah Trading" still read well
  // in non-Latin locales when the supplier hasn't provided a localised
  // override.
  const products = await localizeArray(rawProducts, locale, [
    'title',
    'supplierName'
  ]);

  const base = `/${locale}`;
  const ctaHref = withLocale(base, section.ctaHref);

  return (
    <section aria-labelledby="home-featured" className="space-y-6">
      <SectionHeader
        id="home-featured"
        title={section.title}
        subtitle={section.subtitle}
        ctaLabel={section.ctaLabel}
        ctaHref={ctaHref}
      />

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => (
          <li key={p.id}>
            <Link
              href={`${base}/products/${p.slug}`}
              className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-lg"
            >
              <div className="relative aspect-square overflow-hidden bg-slate-100">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imageUrl}
                    alt={p.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl font-black text-slate-300">
                    {p.title.slice(0, 2).toUpperCase()}
                  </div>
                )}
                {p.isB2B && (
                  <span className="absolute end-2 top-2 rounded-md bg-slate-900/80 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
                    {t('wholesale')}
                  </span>
                )}
              </div>

              <div className="space-y-1.5 p-3">
                <h3 className="line-clamp-2 min-h-[40px] text-sm font-semibold leading-tight text-slate-900 transition group-hover:text-orange-700">
                  {p.title}
                </h3>
                {p.supplierName && (
                  <p className="truncate text-[11px] text-slate-500">
                    {p.supplierName}
                  </p>
                )}
                <p className="flex items-baseline gap-1">
                  {p.minTierPrice !== null && (
                    <span className="text-[11px] font-medium text-slate-400">
                      {t('from')}
                    </span>
                  )}
                  <Price
                    amount={p.minTierPrice ?? Number(p.price)}
                    locale={locale}
                    from={p.minTierCurrency ?? p.currency}
                    className="text-base font-black text-slate-900"
                  />
                </p>
                {p.moq !== null && p.moq > 1 && (
                  <p className="text-[11px] font-medium text-orange-700">
                    {t('moq', { qty: p.moq, unit: p.moqUnit ?? '' })}
                  </p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* -------- Loaders -------- */

type ProductCard = {
  id: string;
  slug: string;
  title: string;
  price: number | string;
  currency: string;
  imageUrl: string | null;
  isB2B: boolean;
  supplierName: string | null;
  moq: number | null;
  moqUnit: string | null;
  /** Cheapest volume-tier unit price — the "from X" number B2B buyers scan. */
  minTierPrice: number | null;
  minTierCurrency: string | null;
};

const CARD_SELECT = {
  id: true,
  slug: true,
  title: true,
  price: true,
  currency: true,
  imageUrl: true,
  isB2B: true,
  moq: true,
  moqUnit: true,
  supplier: { select: { name: true } },
  priceTiers: {
    orderBy: { unitPrice: 'asc' as const },
    take: 1,
    select: { unitPrice: true, currency: true }
  }
} as const;

type CardRow = {
  id: string;
  slug: string;
  title: string;
  price: unknown;
  currency: string;
  imageUrl: string | null;
  isB2B: boolean;
  moq: number | null;
  moqUnit: string | null;
  supplier: { name: string } | null;
  priceTiers: { unitPrice: unknown; currency: string }[];
};

const mapRow = (r: CardRow): ProductCard => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  price: r.price as string,
  currency: r.currency,
  imageUrl: r.imageUrl,
  isB2B: r.isB2B,
  supplierName: r.supplier?.name ?? null,
  moq: r.moq,
  moqUnit: r.moqUnit,
  minTierPrice: r.priceTiers[0] ? Number(r.priceTiers[0].unitPrice) : null,
  minTierCurrency: r.priceTiers[0]?.currency ?? null
});

async function loadProducts(
  pinnedIds: string[],
  limit: number
): Promise<ProductCard[]> {
  if (pinnedIds.length > 0) {
    const rows = (await prisma.product
      .findMany({
        // Even admin-pinned products must be approved+published to render.
        where: { ...PUBLIC_PRODUCT_WHERE, id: { in: pinnedIds } },
        select: CARD_SELECT
      })
      .catch(() => [])) as CardRow[];
    // Preserve admin-defined order.
    const byId = new Map(rows.map((r) => [r.id, r]));
    return pinnedIds
      .map((id) => byId.get(id))
      .filter((r): r is CardRow => Boolean(r))
      .map(mapRow);
  }

  const rows = (await prisma.product
    .findMany({
      where: { ...PUBLIC_PRODUCT_WHERE },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: CARD_SELECT
    })
    .catch(() => [])) as CardRow[];
  return rows.map(mapRow);
}

function clamp(n: number, min: number, max: number) {
  if (Number.isNaN(n) || !Number.isFinite(n)) return min;
  return Math.min(Math.max(Math.floor(n), min), max);
}

function withLocale(base: string, href: string | null): string | null {
  if (!href) return null;
  if (href.startsWith('http')) return href;
  return `${base}${href.startsWith('/') ? href : `/${href}`}`;
}
