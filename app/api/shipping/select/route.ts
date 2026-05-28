import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth/session';
import { ShippingError, selectShippingForOrder } from '@/lib/shipping/service';
import { badRequest, serverError } from '@/lib/api/errors';
import { isNonEmptyString, parseJsonBody } from '@/lib/api/validation';

export const runtime = 'nodejs';

type Body = {
  orderId?: unknown;
  addressId?: unknown;
  shippingMethodId?: unknown;
};

/**
 * POST /api/shipping/select
 *
 * Attaches an address + shipping method to a PENDING order and
 * recomputes `totalPrice` using the DB price of the selected method.
 * Never trusts client-supplied prices.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const parsed = await parseJsonBody<Body>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const { orderId, addressId, shippingMethodId } = parsed.data;

  if (!isNonEmptyString(orderId)) return badRequest('orderId is required');
  if (!isNonEmptyString(addressId)) return badRequest('addressId is required');
  if (!isNonEmptyString(shippingMethodId)) {
    return badRequest('shippingMethodId is required');
  }

  try {
    const order = await selectShippingForOrder({
      orderId,
      userId: user.id,
      isAdmin: user.role === 'ADMIN',
      addressId,
      shippingMethodId
    });
    return NextResponse.json({ data: order });
  } catch (err) {
    if (err instanceof ShippingError) {
      return NextResponse.json(
        { error: err.code, message: err.message, details: err.details },
        { status: err.status }
      );
    }
    console.error('POST /api/shipping/select failed:', err);
    return serverError();
  }
}
