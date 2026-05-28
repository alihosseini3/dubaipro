import { NextResponse } from 'next/server';

import { getAdminOrNull } from '@/lib/auth/require-admin';
import { getCouponStats, listCouponUsages } from '@/lib/coupon/service';
import { serverError } from '@/lib/api/errors';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/coupons/[id]/stats
 *
 * Returns aggregate analytics + the most recent usage rows. Used by the
 * admin coupon detail page.
 */
export async function GET(_request: Request, ctx: RouteContext) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { id } = await ctx.params;
  try {
    const [stats, usages] = await Promise.all([
      getCouponStats(id),
      listCouponUsages(id, 100)
    ]);
    return NextResponse.json({ data: { stats, usages } });
  } catch (err) {
    console.error('GET /api/admin/coupons/[id]/stats failed:', err);
    return serverError();
  }
}
