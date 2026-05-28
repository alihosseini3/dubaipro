import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth/session';
import {
  ReviewError,
  createReview,
  getProductRatingStats,
  getUserReviewForProduct,
  listReviewsForProduct
} from '@/lib/reviews/service';
import {
  badRequest,
  conflict,
  handlePrismaError,
  notFound
} from '@/lib/api/errors';
import { isNonEmptyString, parseJsonBody } from '@/lib/api/validation';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get('productId');
  if (!isNonEmptyString(productId)) {
    return badRequest('productId is required');
  }

  try {
    const [items, stats] = await Promise.all([
      listReviewsForProduct(productId),
      getProductRatingStats(productId)
    ]);

    const user = await getCurrentUser();
    let viewer: {
      canReview: boolean;
      hasReviewed: boolean;
      reviewId: string | null;
    } = { canReview: false, hasReviewed: false, reviewId: null };

    if (user) {
      const existing = await getUserReviewForProduct(user.id, productId);
      viewer = {
        canReview: !existing,
        hasReviewed: !!existing,
        reviewId: existing?.id ?? null
      };
    }

    return NextResponse.json({
      data: items,
      stats,
      viewer
    });
  } catch (error) {
    return handlePrismaError(error, 'GET /api/reviews');
  }
}

type Body = { productId?: unknown; rating?: unknown; comment?: unknown };

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const parsed = await parseJsonBody<Body>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const { productId, rating, comment } = parsed.data;

  if (!isNonEmptyString(productId)) return badRequest('productId is required');
  if (typeof rating !== 'number') return badRequest('rating must be a number');
  if (typeof comment !== 'string') return badRequest('comment is required');

  try {
    const review = await createReview({
      userId: user.id,
      productId,
      rating,
      comment
    });
    return NextResponse.json({ data: review }, { status: 201 });
  } catch (error) {
    if (error instanceof ReviewError) {
      if (error.code === 'product_not_found') return notFound('Product not found');
      if (error.code === 'not_purchased') {
        return NextResponse.json(
          { error: 'not_purchased' },
          { status: 403 }
        );
      }
      if (error.code === 'already_reviewed') return conflict('already_reviewed');
      return badRequest(error.code);
    }
    return handlePrismaError(error, 'POST /api/reviews');
  }
}
