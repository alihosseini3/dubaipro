import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth/session';
import { addToCart, CartError, updateQuantity } from '@/lib/cart/service';
import { badRequest, serverError } from '@/lib/api/errors';
import { isNonEmptyString, parseJsonBody } from '@/lib/api/validation';

export const runtime = 'nodejs';

type Body = {
  productId?: unknown;
  quantity?: unknown;
  /** When true, replace the line quantity instead of incrementing. */
  replace?: unknown;
};

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const parsed = await parseJsonBody<Body>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const { productId, quantity, replace } = parsed.data;

  if (!isNonEmptyString(productId)) {
    return badRequest('productId is required');
  }

  const qty =
    typeof quantity === 'number' && Number.isFinite(quantity) ? quantity : 1;
  if (!Number.isFinite(qty) || qty < 1) {
    return badRequest('quantity must be a positive integer');
  }

  try {
    const cart =
      replace === true
        ? await updateQuantity(user.id, productId, qty)
        : await addToCart(user.id, productId, qty);
    return NextResponse.json({ data: cart });
  } catch (error) {
    if (error instanceof CartError) {
      return NextResponse.json(
        { error: error.code },
        { status: error.status }
      );
    }
    console.error('POST /api/cart/add failed:', error);
    return serverError();
  }
}
