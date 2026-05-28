import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth/session';
import { getCartDTO } from '@/lib/cart/service';
import { removeCouponFromCart } from '@/lib/coupon/service';
import { serverError } from '@/lib/api/errors';

export const runtime = 'nodejs';

/**
 * POST /api/coupon/remove
 *
 * Detach any coupon from the authenticated user's cart. Idempotent.
 * Returns the refreshed cart DTO.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    await removeCouponFromCart(user.id);
    const dto = await getCartDTO(user.id);
    return NextResponse.json({ data: dto });
  } catch (err) {
    console.error('POST /api/coupon/remove failed:', err);
    return serverError();
  }
}
