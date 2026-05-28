/**
 * Segment thresholds. Lifted to constants so the admin UI, the cron,
 * and the audience exporter share one source of truth.
 *
 * Tuning notes:
 *   - HIGH_VALUE_SPEND defaults to 1000 (denominated in the order's
 *     currency, typically AED). Set per-merchant in env if needed.
 *   - HIGH_VALUE_ORDERS catches power buyers whose AOV is small but
 *     who order frequently — they're as valuable as a HIGH_VALUE.
 */
export const HIGH_VALUE_SPEND = Number(process.env.LTV_HIGH_VALUE_SPEND ?? 1000);
export const HIGH_VALUE_ORDERS = Number(process.env.LTV_HIGH_VALUE_ORDERS ?? 5);
export const REPEAT_RECENCY_DAYS = 90;
export const NEW_RECENCY_DAYS = 30;
export const INACTIVE_DAYS = 60;

export type Segment = 'NEW' | 'REPEAT' | 'HIGH_VALUE' | 'INACTIVE';

/**
 * Pure function — same inputs always yield the same segment.
 * Order of checks matters: HIGH_VALUE wins over INACTIVE because a
 * dormant whale is still a whale and we want to reach out as such.
 */
export function classifySegment(input: {
  orderCount: number;
  totalSpent: number;
  firstOrderAt: Date | null;
  lastOrderAt: Date | null;
  now?: Date;
}): Segment {
  const now = input.now ?? new Date();

  if (input.orderCount === 0) return 'NEW';

  if (
    input.totalSpent >= HIGH_VALUE_SPEND ||
    input.orderCount >= HIGH_VALUE_ORDERS
  ) {
    return 'HIGH_VALUE';
  }

  const daysSinceLast = input.lastOrderAt
    ? (now.getTime() - input.lastOrderAt.getTime()) / 86_400_000
    : Infinity;

  if (daysSinceLast > INACTIVE_DAYS) return 'INACTIVE';

  if (input.orderCount === 1) {
    const daysSinceFirst = input.firstOrderAt
      ? (now.getTime() - input.firstOrderAt.getTime()) / 86_400_000
      : 0;
    return daysSinceFirst <= NEW_RECENCY_DAYS ? 'NEW' : 'REPEAT';
  }

  // 2+ orders, recent → REPEAT
  return daysSinceLast <= REPEAT_RECENCY_DAYS ? 'REPEAT' : 'INACTIVE';
}
