import { Prisma, OrderStatus } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { PUBLIC_PRODUCT_WHERE } from '@/lib/products/visibility';

export class ReviewError extends Error {
  constructor(
    public code:
      | 'product_not_found'
      | 'not_purchased'
      | 'already_reviewed'
      | 'invalid_rating'
      | 'invalid_comment',
    message?: string
  ) {
    super(message ?? code);
  }
}

const PURCHASED_STATUSES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED
];

export async function hasUserPurchasedProduct(
  userId: string,
  productId: string
): Promise<boolean> {
  const count = await prisma.orderItem.count({
    where: {
      productId,
      order: { userId, status: { in: PURCHASED_STATUSES } }
    }
  });
  return count > 0;
}

export async function createReview(params: {
  userId: string;
  productId: string;
  rating: number;
  comment: string;
}) {
  const { userId, productId, rating, comment } = params;

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ReviewError('invalid_rating');
  }
  const trimmed = comment.trim();
  if (trimmed.length < 3 || trimmed.length > 2000) {
    throw new ReviewError('invalid_comment');
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, ...PUBLIC_PRODUCT_WHERE },
    select: { id: true }
  });
  if (!product) throw new ReviewError('product_not_found');

  const purchased = await hasUserPurchasedProduct(userId, productId);
  if (!purchased) throw new ReviewError('not_purchased');

  try {
    return await prisma.review.create({
      data: { userId, productId, rating, comment: trimmed }
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      throw new ReviewError('already_reviewed');
    }
    throw err;
  }
}

export async function listReviewsForProduct(productId: string) {
  return prisma.review.findMany({
    where: { productId },
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, name: true } }
    }
  });
}

export async function getProductRatingStats(productId: string) {
  const agg = await prisma.review.aggregate({
    where: { productId },
    _avg: { rating: true },
    _count: { _all: true }
  });
  return {
    average: agg._avg.rating ?? 0,
    count: agg._count._all
  };
}

export async function getUserReviewForProduct(
  userId: string,
  productId: string
) {
  return prisma.review.findUnique({
    where: { userId_productId: { userId, productId } }
  });
}

export async function deleteReview(id: string) {
  try {
    await prisma.review.delete({ where: { id } });
    return true;
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      return false;
    }
    throw err;
  }
}

export async function listAllReviews(params?: {
  skip?: number;
  take?: number;
}) {
  return prisma.review.findMany({
    orderBy: { createdAt: 'desc' },
    skip: params?.skip,
    take: params?.take,
    include: {
      user: { select: { id: true, name: true, email: true } },
      product: { select: { id: true, title: true, slug: true } }
    }
  });
}
