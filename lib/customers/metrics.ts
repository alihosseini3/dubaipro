import 'server-only';

import { prisma } from '@/lib/prisma';

import { classifySegment } from './segments';

/**
 * Recompute the denormalized aggregates for a single user from their
 * PAID orders. Called from:
 *   - the payment service after a successful PAID transition
 *   - the admin "rebuild metrics" action (future)
 *
 * Idempotent — running it twice in a row produces the same row. Safe
 * to call without coordination because we upsert a primary-keyed row.
 *
 * Returns the new metrics row so callers can decide whether to fire
 * a `FIRST_PURCHASE_UPSELL` event (orderCount went from 0 → 1).
 */
export async function recomputeUserMetrics(userId: string): Promise<{
  totalSpent: number;
  orderCount: number;
  firstOrderAt: Date | null;
  lastOrderAt: Date | null;
  segment: 'NEW' | 'REPEAT' | 'HIGH_VALUE' | 'INACTIVE';
  isFirstPurchase: boolean;
} | null> {
  // Single round-trip aggregate — index-backed via @@index([paymentStatus]).
  const agg = await prisma.order.aggregate({
    where: { userId, paymentStatus: 'PAID' },
    _count: { _all: true },
    _sum: { totalPrice: true },
    _min: { paidAt: true },
    _max: { paidAt: true }
  });

  const orderCount = agg._count._all ?? 0;
  const totalSpent = Number(agg._sum.totalPrice ?? 0);
  const firstOrderAt = agg._min.paidAt ?? null;
  const lastOrderAt = agg._max.paidAt ?? null;

  // Read prior state to detect the 0→1 transition (first-purchase event).
  const prior = await prisma.userMetrics
    .findUnique({ where: { userId }, select: { orderCount: true } })
    .catch(() => null);
  const isFirstPurchase = (prior?.orderCount ?? 0) === 0 && orderCount === 1;

  const segment = classifySegment({
    orderCount,
    totalSpent,
    firstOrderAt,
    lastOrderAt
  });

  await prisma.userMetrics.upsert({
    where: { userId },
    create: {
      userId,
      totalSpent,
      lifetimeValue: totalSpent,
      orderCount,
      firstOrderAt,
      lastOrderAt,
      segment,
      computedAt: new Date()
    },
    update: {
      totalSpent,
      lifetimeValue: totalSpent,
      orderCount,
      firstOrderAt,
      lastOrderAt,
      segment,
      computedAt: new Date()
    }
  });

  return { totalSpent, orderCount, firstOrderAt, lastOrderAt, segment, isFirstPurchase };
}

/**
 * Recompute segments for every UserMetrics row whose `lastOrderAt`
 * suggests it might have crossed the INACTIVE boundary since the last
 * recompute. Used by the lifecycle cron — much cheaper than a full
 * table rescan because the index lets pg skip recent rows entirely.
 */
export async function reclassifyDormantSegments(): Promise<number> {
  const cutoff = new Date(Date.now() - 30 * 86_400_000); // ~bigger than NEW window
  const candidates = await prisma.userMetrics.findMany({
    where: {
      OR: [
        { segment: { in: ['NEW', 'REPEAT'] } },
        { lastOrderAt: { lt: cutoff } }
      ]
    },
    select: {
      userId: true,
      orderCount: true,
      totalSpent: true,
      firstOrderAt: true,
      lastOrderAt: true,
      segment: true
    },
    take: 5000
  });

  let updated = 0;
  for (const c of candidates) {
    const next = classifySegment({
      orderCount: c.orderCount,
      totalSpent: Number(c.totalSpent),
      firstOrderAt: c.firstOrderAt,
      lastOrderAt: c.lastOrderAt
    });
    if (next !== c.segment) {
      await prisma.userMetrics.update({
        where: { userId: c.userId },
        data: { segment: next }
      });
      updated++;
    }
  }
  return updated;
}
