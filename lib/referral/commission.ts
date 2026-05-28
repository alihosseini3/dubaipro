import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

/**
 * Default commission rate. Override per-deployment via env without a
 * code change. Clamped to [0, 0.5] so a misconfigured 5.0 doesn't pay
 * out 500%.
 */
function getRate(): number {
  const raw = parseFloat(process.env.REFERRAL_COMMISSION_RATE ?? '0.05');
  if (!Number.isFinite(raw)) return 0.05;
  return Math.min(Math.max(raw, 0), 0.5);
}

/**
 * Record a commission for the given paid order, if the buyer was
 * referred. Safe to call multiple times — the unique constraint on
 * `Commission.orderId` makes this idempotent.
 *
 * Commission base = order.totalPrice MINUS shipping MINUS discount.
 * Rationale: we shouldn't pay affiliate % on shipping (that's 3rd-party
 * cost) or on discounts the marketplace already absorbed.
 *
 * Errors are caught and logged — never thrown — because this runs from
 * payment webhooks where any throw would cause provider retries and
 * could double-process an already-PAID order.
 */
export async function recordCommissionForOrder(orderId: string): Promise<{
  created: boolean;
  reason?: string;
}> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        totalPrice: true,
        shippingPrice: true,
        discountAmount: true,
        items: { select: { product: { select: { currency: true } } }, take: 1 }
      }
    });
    if (!order) return { created: false, reason: 'order_not_found' };

    const referral = await prisma.referral.findUnique({
      where: { referredUserId: order.userId },
      select: { referrerUserId: true }
    });
    if (!referral) return { created: false, reason: 'no_referrer' };
    // Defensive: this should be impossible because linkReferralOnSignup
    // already rejects self-referrals, but the cost of a second check here
    // is one int comparison and it survives any future schema relaxation.
    if (referral.referrerUserId === order.userId) {
      return { created: false, reason: 'self_referral' };
    }

    const rate = getRate();
    if (rate === 0) return { created: false, reason: 'rate_zero' };

    const base = new Prisma.Decimal(order.totalPrice)
      .minus(order.shippingPrice ?? 0)
      .minus(order.discountAmount ?? 0);

    if (base.lessThanOrEqualTo(0)) {
      return { created: false, reason: 'zero_base' };
    }

    const amount = base.mul(rate).toDecimalPlaces(2);
    if (amount.lessThanOrEqualTo(0)) {
      return { created: false, reason: 'rounded_to_zero' };
    }

    const currency = order.items[0]?.product.currency ?? 'AED';

    await prisma.commission.create({
      data: {
        referrerUserId: referral.referrerUserId,
        orderId: order.id,
        amount,
        currency,
        status: 'PENDING'
      }
    });
    return { created: true };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      // Already recorded — totally fine.
      return { created: false, reason: 'already_recorded' };
    }
    // eslint-disable-next-line no-console
    console.error('[referral] recordCommissionForOrder failed', err);
    return { created: false, reason: 'error' };
  }
}
