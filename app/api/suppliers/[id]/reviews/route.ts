/**
 * GET  /api/suppliers/[id]/reviews — paginated reviews + rating breakdown.
 * POST /api/suppliers/[id]/reviews — authenticated user creates a review.
 *
 * The `[id]` segment accepts id or slug; suspended/blacklisted suppliers
 * return 404 even to authenticated users. Each user may write at most one
 * review per supplier (enforced by the unique index in Prisma + service
 * layer).
 */
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import {
  badRequest,
  conflict,
  handlePrismaError,
  notFound
} from '@/lib/api/errors';
import {
  isNonEmptyString,
  parseJsonBody,
  type ValidationErrors
} from '@/lib/api/validation';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import {
  createSupplierReview,
  resolveActiveSupplierIdByParam
} from '@/lib/suppliers';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 10;
const MAX_COMMENT_LENGTH = 5000;
const MAX_TITLE_LENGTH = 200;

export async function GET(request: Request, { params }: Params) {
  const { id: idOrSlug } = await params;

  try {
    const resolved = await resolveActiveSupplierIdByParam(idOrSlug);
    if (!resolved) return notFound('Supplier not found');

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Number(searchParams.get('pageSize')) || DEFAULT_PAGE_SIZE)
    );
    const ratingFilter = Number(searchParams.get('rating'));

    const where: Prisma.SupplierReviewWhereInput = { supplierId: resolved.id };
    if (Number.isFinite(ratingFilter) && ratingFilter >= 1 && ratingFilter <= 5) {
      where.rating = Math.floor(ratingFilter);
    }

    const [rows, total, breakdown, supplierMeta] = await Promise.all([
      prisma.supplierReview.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          rating: true,
          title: true,
          comment: true,
          isVerifiedPurchase: true,
          supplierReplyContent: true,
          supplierReplyAt: true,
          createdAt: true,
          user: { select: { id: true, name: true } }
        }
      }),
      prisma.supplierReview.count({ where }),
      prisma.supplierReview.groupBy({
        by: ['rating'],
        where: { supplierId: resolved.id },
        _count: { _all: true }
      }),
      prisma.supplier.findUnique({
        where: { id: resolved.id },
        select: { ratingAvg: true, ratingCount: true }
      })
    ]);

    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const b of breakdown) counts[b.rating] = b._count._all;

    const viewer = await getCurrentUser();
    let viewerState: {
      canReview: boolean;
      hasReviewed: boolean;
      reviewId: string | null;
    } = { canReview: false, hasReviewed: false, reviewId: null };

    if (viewer) {
      const existing = await prisma.supplierReview.findUnique({
        where: {
          supplierId_userId: { supplierId: resolved.id, userId: viewer.id }
        },
        select: { id: true }
      });
      viewerState = {
        canReview: !existing,
        hasReviewed: !!existing,
        reviewId: existing?.id ?? null
      };
    }

    return NextResponse.json({
      data: rows,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      },
      stats: {
        ratingAvg: supplierMeta?.ratingAvg ?? 0,
        ratingCount: supplierMeta?.ratingCount ?? 0,
        breakdown: counts
      },
      viewer: viewerState
    });
  } catch (error) {
    return handlePrismaError(error, `GET /api/suppliers/${idOrSlug}/reviews`);
  }
}

type CreateBody = {
  rating?: unknown;
  comment?: unknown;
  title?: unknown;
  orderId?: unknown;
};

export async function POST(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id: idOrSlug } = await params;
  const resolved = await resolveActiveSupplierIdByParam(idOrSlug);
  if (!resolved) return notFound('Supplier not found');

  const parsed = await parseJsonBody<CreateBody>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const body = parsed.data;

  const errors: ValidationErrors = {};
  if (typeof body.rating !== 'number' || !Number.isFinite(body.rating)) {
    errors.rating = 'rating must be a number between 1 and 5';
  } else if (body.rating < 1 || body.rating > 5) {
    errors.rating = 'rating must be between 1 and 5';
  }
  if (!isNonEmptyString(body.comment)) {
    errors.comment = 'comment is required';
  } else if (body.comment.length > MAX_COMMENT_LENGTH) {
    errors.comment = `comment must be at most ${MAX_COMMENT_LENGTH} characters`;
  }
  if (body.title !== undefined && body.title !== null) {
    if (typeof body.title !== 'string') {
      errors.title = 'title must be a string';
    } else if (body.title.length > MAX_TITLE_LENGTH) {
      errors.title = `title must be at most ${MAX_TITLE_LENGTH} characters`;
    }
  }
  if (body.orderId !== undefined && body.orderId !== null && typeof body.orderId !== 'string') {
    errors.orderId = 'orderId must be a string';
  }

  if (Object.keys(errors).length > 0) {
    return badRequest('Validation failed', errors);
  }

  try {
    const review = await createSupplierReview({
      supplierId: resolved.id,
      userId: user.id,
      rating: body.rating as number,
      comment: (body.comment as string).trim(),
      title: typeof body.title === 'string' ? body.title : null,
      orderId: typeof body.orderId === 'string' ? body.orderId : null
    });
    return NextResponse.json({ data: review }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return conflict('already_reviewed');
    }
    return handlePrismaError(error, `POST /api/suppliers/${idOrSlug}/reviews`);
  }
}
