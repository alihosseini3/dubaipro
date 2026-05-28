import { NextResponse } from 'next/server';

import { getAdminOrNull } from '@/lib/auth/require-admin';
import { handlePrismaError, notFound } from '@/lib/api/errors';
import { deleteReview } from '@/lib/reviews/service';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const admin = await getAdminOrNull();
  if (!admin) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const ok = await deleteReview(id);
    if (!ok) return notFound('Review not found');
    return NextResponse.json({ data: { id } });
  } catch (error) {
    return handlePrismaError(error, 'DELETE /api/admin/reviews/[id]');
  }
}
