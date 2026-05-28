import 'server-only';

import { OrderStatus, Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

/**
 * Supplier-review domain service.
 *
 * Guarantees:
 *  - Exactly one review per (supplier, user) — DB unique enforces this.
 *  - `rating` is clamped to [1..5] at the service boundary.
 *  - `isVerifiedPurchase` is computed (never trusted from the client) by
 *    confirming the supplied `orderId`:
 *      • belongs to the same user,
 *      • is in a paid/post-paid status (PAID/PROCESSING/SHIPPED/DELIVERED),
 *      • contains at least one item from the target supplier.
 *  - `Supplier.ratingAvg` / `ratingCount` are recomputed inside the same
 *    transaction so the storefront never shows a stale average.
 */

export type CreateReviewInput = {
  supplierId: string;
  userId: string;
  rating: number;
  comment: string;
  title?: string | null;
  orderId?: string | null;
};

const REVENUE_STATUSES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED
];

export async function createSupplierReview(input: CreateReviewInput) {
  const rating = Math.max(1, Math.min(5, Math.round(input.rating)));
  const comment = input.comment.trim();
  if (comment.length === 0) {
    throw new Error('comment is required');
  }

  const verifiedPurchase = input.orderId
    ? await verifyPurchaseLink({
        orderId: input.orderId,
        supplierId: input.supplierId,
        userId: input.userId
      })
    : false;

  return prisma.$transaction(async (tx) => {
    const review = await tx.supplierReview.create({
      data: {
        supplierId: input.supplierId,
        userId: input.userId,
        rating,
        comment,
        title: input.title?.trim() ?? null,
        orderId: input.orderId ?? null,
        isVerifiedPurchase: verifiedPurchase
      }
    });

    await recomputeRatingInTx(tx, input.supplierId);
    return review;
  });
}

export type UpdateReviewInput = {
  reviewId: string;
  userId: string;
  rating?: number;
  comment?: string;
  title?: string | null;
};

/** Author can edit their own review; rating/avg are recomputed if changed. */
export async function updateSupplierReview(input: UpdateReviewInput) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.supplierReview.findUnique({
      where: { id: input.reviewId },
      select: { id: true, userId: true, supplierId: true }
    });
    if (!existing || existing.userId !== input.userId) {
      throw new Error('Review not found or not owned by user');
    }

    const data: Prisma.SupplierReviewUpdateInput = {};
    if (typeof input.rating === 'number') {
      data.rating = Math.max(1, Math.min(5, Math.round(input.rating)));
    }
    if (typeof input.comment === 'string') {
      const trimmed = input.comment.trim();
      if (trimmed.length === 0) throw new Error('comment cannot be empty');
      data.comment = trimmed;
    }
    if (input.title !== undefined) {
      data.title = input.title?.trim() ?? null;
    }

    const updated = await tx.supplierReview.update({
      where: { id: input.reviewId },
      data
    });

    if (typeof input.rating === 'number') {
      await recomputeRatingInTx(tx, existing.supplierId);
    }
    return updated;
  });
}

/** Author or admin may delete; rating aggregate is recomputed. */
export async function deleteSupplierReview(reviewId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.supplierReview.findUnique({
      where: { id: reviewId },
      select: { supplierId: true }
    });
    if (!existing) return null;

    await tx.supplierReview.delete({ where: { id: reviewId } });
    await recomputeRatingInTx(tx, existing.supplierId);
    return existing;
  });
}

/** Supplier replies to a review on their own profile. */
export async function replyToSupplierReview(
  reviewId: string,
  supplierId: string,
  replyContent: string
) {
  const content = replyContent.trim();
  if (content.length === 0) throw new Error('reply cannot be empty');

  const existing = await prisma.supplierReview.findUnique({
    where: { id: reviewId },
    select: { id: true, supplierId: true }
  });
  if (!existing || existing.supplierId !== supplierId) {
    throw new Error('Review not found for this supplier');
  }

  return prisma.supplierReview.update({
    where: { id: reviewId },
    data: {
      supplierReplyContent: content,
      supplierReplyAt: new Date()
    }
  });
}

// ─── Internals ────────────────────────────────────────────────────────────

async function verifyPurchaseLink(args: {
  orderId: string;
  supplierId: string;
  userId: string;
}): Promise<boolean> {
  const order = await prisma.order.findUnique({
    where: { id: args.orderId },
    select: { id: true, userId: true, status: true }
  });
  if (!order) return false;
  if (order.userId !== args.userId) return false;
  if (!REVENUE_STATUSES.includes(order.status)) return false;

  const hasItem = await prisma.orderItem.findFirst({
    where: {
      orderId: args.orderId,
      product: { supplierId: args.supplierId }
    },
    select: { id: true }
  });
  return !!hasItem;
}

/**
 * Recompute and persist `ratingAvg` + `ratingCount` for a supplier.
 * Exported as a helper for admin repair tools too.
 */
export async function recomputeSupplierRating(supplierId: string) {
  return prisma.$transaction(async (tx) => recomputeRatingInTx(tx, supplierId));
}

async function recomputeRatingInTx(
  tx: Prisma.TransactionClient,
  supplierId: string
) {
  const agg = await tx.supplierReview.aggregate({
    where: { supplierId },
    _avg: { rating: true },
    _count: { _all: true }
  });

  const avg = agg._avg.rating ?? 0;
  const count = agg._count._all;

  await tx.supplier.update({
    where: { id: supplierId },
    data: {
      ratingAvg: Number.isFinite(avg) ? Number(avg.toFixed(2)) : 0,
      ratingCount: count
    }
  });

  return { ratingAvg: avg, ratingCount: count };
}
