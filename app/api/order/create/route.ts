import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { Prisma } from '@prisma/client';

import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { getOrCreateCart } from '@/lib/cart/service';
import {
  computeDiscount,
  isCouponUsable,
  recordCouponUsage,
  type CouponCartLine
} from '@/lib/coupon/service';
import { serverError } from '@/lib/api/errors';

export const runtime = 'nodejs';

/**
 * POST /api/order/create
 *
 * Atomically:
 *   1. Re-reads cart (prevents race with stale client total)
 *   2. Re-validates stock for each line
 *   3. Creates an Order + OrderItems snapshotting current prices
 *   4. Empties the cart
 *
 * Future-ready hooks (intentionally not implemented yet):
 *   - payment gateway (create PaymentIntent before marking PAID)
 *   - coupon / discount application
 *   - shipping address + cost calculation
 *   - per-supplier splitting
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const cart = await getOrCreateCart(user.id);
    if (cart.items.length === 0) {
      return NextResponse.json({ error: 'empty_cart' }, { status: 400 });
    }

    // Re-validate stock and compute authoritative total.
    for (const line of cart.items) {
      if (line.product.stock <= 0) {
        return NextResponse.json(
          { error: 'out_of_stock', productId: line.productId },
          { status: 409 }
        );
      }
      if (line.quantity > line.product.stock) {
        return NextResponse.json(
          {
            error: 'insufficient_stock',
            productId: line.productId,
            available: line.product.stock
          },
          { status: 409 }
        );
      }
    }

    const subtotal = cart.items.reduce((acc, line) => {
      return acc + Number(line.product.price) * line.quantity;
    }, 0);

    // Resolve the cart's coupon, if any, and snapshot it onto the order
    // so historical rows remain correct even after the coupon is edited
    // or deleted. If the coupon became invalid since it was attached,
    // we silently drop it rather than blocking checkout.
    const couponItems: CouponCartLine[] = cart.items.map((l) => ({
      productId: l.productId,
      categoryId: l.product.categoryId,
      quantity: l.quantity,
      price: Number(l.product.price)
    }));
    const couponCtx = { userId: user.id, items: couponItems };

    let discountAmount = 0;
    let couponId: string | null = null;
    let couponCode: string | null = null;
    if (cart.coupon && isCouponUsable(cart.coupon, subtotal, couponCtx)) {
      discountAmount = computeDiscount(cart.coupon, subtotal);
      couponId = cart.coupon.id;
      couponCode = cart.coupon.code;
    }

    const totalPrice = Math.max(0, subtotal - discountAmount);

    // WhatsApp click attribution. Read-only; if anything looks off we
    // drop it silently — checkout must never fail on attribution logic.
    let whatsappClickId: string | null = null;
    try {
      const raw = (await cookies()).get('mp.waclick')?.value ?? '';
      if (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          raw
        )
      ) {
        whatsappClickId = raw.toLowerCase();
      }
    } catch {
      // ignore
    }

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          userId: user.id,
          totalPrice: new Prisma.Decimal(totalPrice.toFixed(2)),
          discountAmount: new Prisma.Decimal(discountAmount.toFixed(2)),
          couponId,
          couponCode,
          whatsappClickId,
          status: 'PENDING',
          items: {
            create: cart.items.map((line) => ({
              productId: line.productId,
              quantity: line.quantity,
              price: line.product.price
            }))
          }
        },
        include: {
          items: {
            include: {
              product: {
                select: { id: true, title: true, slug: true, imageUrl: true }
              }
            }
          }
        }
      });

      // Reserve one coupon redemption. `isCouponUsable` was checked
      // against a freshly-read row above, so the window for overshooting
      // `usageLimit` is narrow (two concurrent checkouts racing). A strict
      // guarantee would require SELECT ... FOR UPDATE, which we defer
      // until coupon abuse becomes a measurable problem.
      if (couponId) {
        await tx.coupon.update({
          where: { id: couponId },
          data: { usedCount: { increment: 1 } }
        });
        // Per-user limit + history + analytics rely on this row. Unique
        // on `orderId` makes it idempotent if the tx ever retries.
        await recordCouponUsage(tx, {
          couponId,
          userId: user.id,
          orderId: created.id
        });
      }

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      // Detach the coupon from the now-empty cart.
      await tx.cart.update({
        where: { id: cart.id },
        data: { couponId: null }
      });
      return created;
    });

    return NextResponse.json({ data: order }, { status: 201 });
  } catch (error) {
    console.error('POST /api/order/create failed:', error);
    return serverError();
  }
}
