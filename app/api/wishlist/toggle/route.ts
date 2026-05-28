import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth/session';
import { toggleWishlistProduct } from '@/lib/wishlist/service';
import { badRequest, handlePrismaError, notFound } from '@/lib/api/errors';
import { isNonEmptyString, parseJsonBody } from '@/lib/api/validation';

export const runtime = 'nodejs';

type Body = { productId?: unknown };

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
    const result = await toggleWishlistProduct(user.id, productId);
    return NextResponse.json({ data: result });
  } catch (error) {
    if (error instanceof Error && error.message === 'product_not_found') {
      return notFound('Product not found');
    }
    return handlePrismaError(error, 'POST /api/wishlist/toggle');
  }
}
