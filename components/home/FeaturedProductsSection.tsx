import Link from 'next/link';

import { Price } from '@/components/currency/Price';
import type { HomepageSectionDTO } from '@/lib/homepage/types';
import { localizeArray } from '@/lib/i18n/localize';
import { prisma } from '@/lib/prisma';

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
 * The card includes image, title, supplier, and a localized price
 * (AED → user's display currency, via the existing <Price> server
 * component). No client JS for the cards themselves — clicks just
 * navigate to the PDP.
 */
export async function FeaturedProductsSection({ locale, section }: Props) {
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
                    Wholesale
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
                <Price
                  amount={Number(p.price)}
                  locale={locale}
                  from={p.currency}
                  className="block text-base font-black text-slate-900"
                />
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
};

async function loadProducts(
  pinnedIds: string[],
  limit: number
): Promise<ProductCard[]> {
  if (pinnedIds.length > 0) {
    const rows = await prisma.product
      .findMany({
        where: { id: { in: pinnedIds } },
        select: {
          id: true,
          slug: true,
          title: true,
          price: true,
          currency: true,
          imageUrl: true,
          isB2B: true,
          supplier: { select: { name: true } }
        }
      })
      .catch(() => []);
    // Preserve admin-defined order.
    const byId = new Map(rows.map((r) => [r.id, r]));
    return pinnedIds
      .map((id) => byId.get(id))
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        price: r.price as unknown as string,
        currency: r.currency,
        imageUrl: r.imageUrl,
        isB2B: r.isB2B,
        supplierName: r.supplier?.name ?? null
      }));
  }

  const rows = await prisma.product
    .findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        slug: true,
        title: true,
        price: true,
        currency: true,
        imageUrl: true,
        isB2B: true,
        supplier: { select: { name: true } }
      }
    })
    .catch(() => []);
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    price: r.price as unknown as string,
    currency: r.currency,
    imageUrl: r.imageUrl,
    isB2B: r.isB2B,
    supplierName: r.supplier?.name ?? null
  }));
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
