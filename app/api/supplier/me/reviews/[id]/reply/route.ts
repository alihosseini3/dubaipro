/**
 * POST /api/supplier/me/reviews/[id]/reply
 *
 * The authenticated supplier publishes (or overwrites) a public reply to
 * one of their own reviews. Ownership is enforced by the service —
 * supplier id from session, reviewId from URL.
 */
import { NextResponse } from 'next/server';

import {
  badRequest,
  handlePrismaError,
  notFound
} from '@/lib/api/errors';
import {
  isNonEmptyString,
  parseJsonBody
} from '@/lib/api/validation';
import { getSupplierContextOrNull } from '@/lib/auth/require-supplier';
import { memberHasPermission } from '@/lib/auth/permissions';
import { replyToSupplierReview } from '@/lib/suppliers';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

const MAX_REPLY = 2000;

type Body = { content?: unknown };

export async function POST(request: Request, { params }: Params) {
  const ctx = await getSupplierContextOrNull();
  if (!ctx) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (!memberHasPermission(ctx.member.role, 'supplier.profile.manage', ctx.member.permissions)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { id: reviewId } = await params;

  const parsed = await parseJsonBody<Body>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const { content } = parsed.data;

  if (!isNonEmptyString(content)) {
    return badRequest('content is required');
  }
  if (content.length > MAX_REPLY) {
    return badRequest(`content must be ≤ ${MAX_REPLY} chars`);
  }

  try {
    const updated = await replyToSupplierReview(
      reviewId,
      ctx.supplier.id,
      content
    );
    return NextResponse.json({ data: updated });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return notFound('Review not found');
    }
    return handlePrismaError(
      error,
      `POST /api/supplier/me/reviews/${reviewId}/reply`
    );
  }
}
