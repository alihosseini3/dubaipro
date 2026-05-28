import { NextResponse } from 'next/server';

import { getAdminOrNull } from '@/lib/auth/require-admin';
import {
  CouponError,
  deleteCoupon,
  updateCoupon
} from '@/lib/coupon/service';
import { badRequest, serverError } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';
import type { CouponInput } from '@/types/coupon';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH  /api/admin/coupons/[id]  — partial update (any CouponInput field)
 * DELETE /api/admin/coupons/[id]  — hard delete (orders keep couponCode snapshot)
 */
export async function PATCH(request: Request, ctx: RouteContext) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { id } = await ctx.params;
  const parsed = await parseJsonBody<Partial<CouponInput>>(request);
  if (!parsed.ok) return badRequest(parsed.error);

  try {
    const coupon = await updateCoupon(id, parsed.data);
    return NextResponse.json({ data: coupon });
  } catch (err) {
    if (err instanceof CouponError) {
      return NextResponse.json(
        { error: err.code, message: err.message, details: err.details },
        { status: err.status }
      );
    }
    console.error('PATCH /api/admin/coupons/[id] failed:', err);
    return serverError();
  }
}

export async function DELETE(_request: Request, ctx: RouteContext) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { id } = await ctx.params;
  try {
    await deleteCoupon(id);
    return NextResponse.json({ data: { id } });
  } catch (err) {
    console.error('DELETE /api/admin/coupons/[id] failed:', err);
    return serverError();
  }
}
