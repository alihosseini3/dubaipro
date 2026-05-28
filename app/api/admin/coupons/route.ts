import { NextResponse } from 'next/server';

import { getAdminOrNull } from '@/lib/auth/require-admin';
import {
  CouponError,
  createCoupon,
  listCoupons
} from '@/lib/coupon/service';
import { badRequest, serverError } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';
import type { CouponInput } from '@/types/coupon';

export const runtime = 'nodejs';

/**
 * GET  /api/admin/coupons  — list all coupons (admin only)
 * POST /api/admin/coupons  — create a coupon
 */
export async function GET() {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  try {
    const coupons = await listCoupons();
    return NextResponse.json({ data: coupons });
  } catch (err) {
    console.error('GET /api/admin/coupons failed:', err);
    return serverError();
  }
}

export async function POST(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const parsed = await parseJsonBody<Partial<CouponInput>>(request);
  if (!parsed.ok) return badRequest(parsed.error);

  try {
    const coupon = await createCoupon(parsed.data as CouponInput);
    return NextResponse.json({ data: coupon }, { status: 201 });
  } catch (err) {
    if (err instanceof CouponError) {
      return NextResponse.json(
        { error: err.code, message: err.message, details: err.details },
        { status: err.status }
      );
    }
    console.error('POST /api/admin/coupons failed:', err);
    return serverError();
  }
}
