import { NextResponse } from 'next/server';

import { createRoute } from '@/lib/api/handler';
import { notFound } from '@/lib/api/errors';
import { deleteReview } from '@/lib/reviews/service';

export const runtime = 'nodejs';

export const DELETE = createRoute(
  {
    auth: 'admin',
    audit: { action: 'review.delete', entityType: 'Review' }
  },
  async ({ params, audit }) => {
    const id = String(params.id);

    const ok = await deleteReview(id);
    if (!ok) return notFound('Review not found');

    audit.entityId = id;
    return NextResponse.json({ data: { id } });
  }
);
