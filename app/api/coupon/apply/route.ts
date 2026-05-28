import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth/session';
import { getCartDTO, getOrCreateCart } from '@/lib/cart/service';
import { CouponError, applyCouponByCode } from '@/lib/coupon/service';
import { badRequest, serverError } from '@/lib/api/errors';
import { isNonEmptyString, parseJsonBody } from '@/lib/api/validation';

export const runtime = 'nodejs';

type Body = { code?: unknown };

/**
 * POST /api/coupon/apply
 *
 * Attach a coupon (by code) to the authenticated user's cart. Always
 * returns the full, fresh cart DTO on success so the UI can replace
 * its local state without re-fetching.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const parsed = await parseJsonBody<Body>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  if (!isNonEmptyString(parsed.data.code)) return badRequest('code is required');

  try {
    const cart = await getOrCreateCart(user.id);
    const subtotal = cart.items.reduce(
      (acc, line) => acc + Number(line.product.price) * line.quantity,
      0
    );
    const items = cart.items.map((l) => ({
      productId: l.productId,
      categoryId: l.product.categoryId,
      quantity: l.quantity,
      price: Number(l.product.price)
    }));
    await applyCouponByCode({
      userId: user.id,
      code: parsed.data.code,
      subtotal,
      items
    });
    const dto = await getCartDTO(user.id);
    return NextResponse.json({ data: dto });
  } catch (err) {
    if (err instanceof CouponError) {
      return NextResponse.json(
        { error: err.code, message: err.message, details: err.details },
        { status: err.status }
      );
    }
    console.error('POST /api/coupon/apply failed:', err);
    return serverError();
  }
}
