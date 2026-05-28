import { NextResponse } from 'next/server';

import { calculateShipping } from '@/lib/shipping/calculate';
import { serverError } from '@/lib/api/errors';
import type { ShippingItemInput } from '@/types/shipping';

export const runtime = 'nodejs';

/**
 * POST /api/shipping/quote
 *
 * Body: { country: string, items: ShippingItemInput[], methodId?: string }
 *
 * Public-safe: server reads only client-supplied dimensions; never trusts
 * a price. Used by checkout for live preview AND by the admin tester.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      country?: string;
      items?: ShippingItemInput[];
      methodId?: string;
    };
    if (!body.country || typeof body.country !== 'string') {
      return NextResponse.json({ error: 'country_required' }, { status: 400 });
    }
    if (!Array.isArray(body.items)) {
      return NextResponse.json({ error: 'items_required' }, { status: 400 });
    }
    const sanitized: ShippingItemInput[] = body.items.map((it) => ({
      weight: typeof it.weight === 'number' ? it.weight : null,
      length: typeof it.length === 'number' ? it.length : null,
      width: typeof it.width === 'number' ? it.width : null,
      height: typeof it.height === 'number' ? it.height : null,
      shippingClass:
        typeof it.shippingClass === 'string' ? it.shippingClass : null,
      quantity: Number.isFinite(it.quantity) ? Number(it.quantity) : 1
    }));
    const result = await calculateShipping({
      country: body.country,
      items: sanitized,
      methodId: body.methodId ?? null
    });
    return NextResponse.json({ data: result });
  } catch (err) {
    console.error('POST /api/shipping/quote failed:', err);
    return serverError();
  }
}
