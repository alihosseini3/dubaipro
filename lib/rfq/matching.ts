import 'server-only';

import { prisma } from '@/lib/prisma';

const TIER_WEIGHT: Record<string, number> = {
  GUARANTEED: 30,
  VERIFIED:   20,
  STANDARD:    0,
};

/**
 * Find ACTIVE suppliers most likely to respond to an RFQ.
 *
 * Pre-filters at the DB level (category match OR ships to destination) so the
 * in-memory scoring step operates on ≤ 100 relevant rows instead of scanning
 * every active supplier.
 */
export async function matchSuppliersForRfq(
  rfqId: string,
  limit = 10
): Promise<string[]> {
  const rfq = await prisma.rfqRequest.findUnique({
    where: { id: rfqId },
    select: { categoryId: true, shippingCountry: true },
  });
  if (!rfq) return [];

  const catFilter = rfq.categoryId
    ? { products: { some: { categoryId: rfq.categoryId } } }
    : undefined;

  const marketFilter = {
    OR: [
      { exportMarkets: { has: rfq.shippingCountry } },
      { exportMarkets: { has: '*' } },
    ],
  };

  const suppliers = await prisma.supplier.findMany({
    where: {
      status: 'ACTIVE',
      OR: [
        ...(catFilter ? [catFilter] : []),
        marketFilter,
      ],
    },
    select: {
      id:            true,
      tier:          true,
      ratingAvg:     true,
      exportMarkets: true,
      products: { select: { categoryId: true }, take: 50 },
    },
    take: 100,
  });

  const scored = suppliers.map((s) => {
    let score = TIER_WEIGHT[s.tier] ?? 0;
    score += s.ratingAvg * 5;

    if (rfq.categoryId) {
      const catHits = s.products.filter((p) => p.categoryId === rfq.categoryId).length;
      score += Math.min(catHits * 3, 30);
    }

    if (s.exportMarkets.includes(rfq.shippingCountry) || s.exportMarkets.includes('*')) {
      score += 10;
    }

    return { id: s.id, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.id);
}

/**
 * Returns open RFQ IDs relevant to a supplier's category mix.
 * Ordered by fewest quotes first (more opportunity) then recency.
 */
export async function getRecommendedRfqsForSupplier(
  supplierId: string,
  limit = 20
): Promise<string[]> {
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    select: {
      exportMarkets: true,
      products: { select: { categoryId: true }, take: 50 },
    },
  });
  if (!supplier) return [];

  const categoryIds = [...new Set(supplier.products.map((p) => p.categoryId).filter(Boolean))];

  const rfqs = await prisma.rfqRequest.findMany({
    where: {
      status: { in: ['OPEN', 'NEGOTIATING'] },
      visibility: { not: 'PRIVATE' },
      ...(categoryIds.length > 0 ? { categoryId: { in: categoryIds } } : {}),
    },
    select: { id: true },
    orderBy: [{ quoteCount: 'asc' }, { createdAt: 'desc' }],
    take: limit,
  });

  return rfqs.map((r) => r.id);
}
