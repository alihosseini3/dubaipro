import Link from 'next/link';

import type { SupplierTier } from '@prisma/client';

import { SupplierTierBadge } from '@/components/suppliers/SupplierTierBadge';
import type { HomepageSectionDTO } from '@/lib/homepage/types';
import { localizeArray } from '@/lib/i18n/localize';
import { prisma } from '@/lib/prisma';

import { SectionHeader } from './CategoriesSection';
import { ArrowRightIcon, VerifiedIcon } from './icons';

type Props = { locale: string; section: HomepageSectionDTO };

const ACCENT_PAIRS = [
  'from-orange-500 to-orange-600',
  'from-sky-500 to-sky-600',
  'from-emerald-500 to-emerald-600',
  'from-violet-500 to-violet-600',
  'from-rose-500 to-rose-600',
  'from-amber-500 to-amber-600'
];

/**
 * Top-suppliers band — 3–12 supplier cards.
 *
 * Source order:
 *   1. `config.supplierIds` (admin curated). Missing IDs (deleted /
 *      soft-removed suppliers) are skipped silently.
 *   2. Otherwise, verified suppliers ordered by product count.
 *
 * Card content stays minimal because the `Supplier` schema has no
 * logo/cover today — we render an initial chip + country + product
 * count, which is enough to differentiate at a glance and degrades
 * gracefully when a supplier gets a real avatar later.
 */
export async function TopSuppliersSection({ locale, section }: Props) {
  const cfgIds = (section.config.supplierIds as string[] | undefined) ?? [];
  const limit = clamp((section.config.limit as number | undefined) ?? 6, 3, 12);

  const rawSuppliers = await loadSuppliers(cfgIds, limit);
  if (rawSuppliers.length === 0) return null;
  // Translate supplier name + country. Supplier names are often Latin
  // brand strings, so the translator is instructed (in the system
  // prompt) to leave true brand names alone.
  const suppliers = await localizeArray(rawSuppliers, locale, [
    'name',
    'country'
  ]);

  const base = `/${locale}`;
  const ctaHref = withLocale(base, section.ctaHref);

  return (
    <section aria-labelledby="home-suppliers" className="space-y-6">
      <SectionHeader
        id="home-suppliers"
        title={section.title}
        subtitle={section.subtitle}
        ctaLabel={section.ctaLabel}
        ctaHref={ctaHref}
      />

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {suppliers.map((s, i) => (
          <li key={s.id}>
            <Link
              href={`${base}/suppliers/${s.slug ?? s.id}`}
              className="group flex h-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-lg"
            >
              <span
                className={`relative inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-lg font-black text-white shadow-md ${
                  ACCENT_PAIRS[i % ACCENT_PAIRS.length]
                }`}
              >
                {s.name.slice(0, 2).toUpperCase()}
                {s.tier !== 'STANDARD' && (
                  <span className="absolute -end-1 -bottom-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-emerald-600 shadow ring-2 ring-white">
                    <VerifiedIcon className="h-4 w-4" />
                  </span>
                )}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-sm font-bold text-slate-900 transition group-hover:text-orange-700">
                    {s.name}
                  </h3>
                  <SupplierTierBadge
                    tier={s.tier}
                    compact
                    labels={{ verified: 'Verified', guaranteed: 'Guaranteed' }}
                  />
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {s.country}
                </p>
                <p className="mt-1 flex items-center gap-2 text-[11px] font-medium text-slate-600">
                  <span>
                    {s.productCount}{' '}
                    {s.productCount === 1 ? 'product' : 'products'}
                  </span>
                  {s.ratingCount > 0 ? (
                    <span className="text-amber-600">
                      ★ {s.ratingAvg.toFixed(1)}
                    </span>
                  ) : null}
                </p>
              </div>

              <ArrowRightIcon className="h-4 w-4 text-slate-300 transition group-hover:text-orange-500 rtl:-scale-x-100" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* -------- Loader -------- */

type SupplierCard = {
  id: string;
  slug: string | null;
  name: string;
  country: string;
  tier: SupplierTier;
  productCount: number;
  ratingAvg: number;
  ratingCount: number;
  followerCount: number;
};

const SELECT = {
  id: true,
  slug: true,
  name: true,
  country: true,
  tier: true,
  ratingAvg: true,
  ratingCount: true,
  followerCount: true,
  _count: { select: { products: true } }
} as const;

type Row = {
  id: string;
  slug: string | null;
  name: string;
  country: string;
  tier: SupplierTier;
  ratingAvg: number;
  ratingCount: number;
  followerCount: number;
  _count: { products: number };
};

const mapRow = (r: Row): SupplierCard => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  country: r.country,
  tier: r.tier,
  ratingAvg: r.ratingAvg,
  ratingCount: r.ratingCount,
  followerCount: r.followerCount,
  productCount: r._count.products
});

// Tier weight + rating + followers ranking. Pure in-memory because
// Prisma can't sort on the synthesized score directly.
const TIER_WEIGHT: Record<SupplierTier, number> = {
  GUARANTEED: 200,
  VERIFIED: 100,
  STANDARD: 0
};
const score = (s: SupplierCard) =>
  TIER_WEIGHT[s.tier] +
  s.ratingAvg * 10 +
  Math.log2(1 + s.followerCount) * 4 +
  Math.log2(1 + s.productCount);

async function loadSuppliers(
  pinnedIds: string[],
  limit: number
): Promise<SupplierCard[]> {
  if (pinnedIds.length > 0) {
    const rows = (await prisma.supplier
      .findMany({
        where: { id: { in: pinnedIds }, status: 'ACTIVE' },
        select: SELECT
      })
      .catch(() => [])) as Row[];
    const byId = new Map(rows.map((r) => [r.id, r]));
    return pinnedIds
      .map((id) => byId.get(id))
      .filter((r): r is Row => Boolean(r))
      .map(mapRow);
  }

  const rows = (await prisma.supplier
    .findMany({
      where: { status: 'ACTIVE' },
      select: SELECT,
      take: 60
    })
    .catch(() => [])) as Row[];

  return rows.map(mapRow).sort((a, b) => score(b) - score(a)).slice(0, limit);
}

/* -------- Helpers -------- */

function clamp(n: number, min: number, max: number) {
  if (Number.isNaN(n) || !Number.isFinite(n)) return min;
  return Math.min(Math.max(Math.floor(n), min), max);
}

function withLocale(base: string, href: string | null): string | null {
  if (!href) return null;
  if (href.startsWith('http')) return href;
  return `${base}${href.startsWith('/') ? href : `/${href}`}`;
}
