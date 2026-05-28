import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth/session';
import { removeFromCart, CartError } from '@/lib/cart/service';
import { badRequest, serverError } from '@/lib/api/errors';
import { isNonEmptyString, parseJsonBody } from '@/lib/api/validation';

export const runtime = 'nodejs';

type Body = {
  productId?: unknown;
};

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const parsed = await parseJsonBody<Body>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const { productId } = parsed.data;

  if (!isNonEmptyString(productId)) {
    return badRequest('productId is required');
  }

  try {
    const cart = await removeFromCart(user.id, productId);
    return NextResponse.json({ data: cart });
  } catch (error) {
    if (error instanceof CartError) {
      return NextResponse.json(
        { error: error.code },
        { status: error.status }
      );
    }
    console.error('POST /api/cart/remove failed:', error);
    return serverError();
  }
}
