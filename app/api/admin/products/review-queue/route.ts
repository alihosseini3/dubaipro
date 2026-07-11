import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createRoute } from '@/lib/api/handler';
import { listReviewQueue } from '@/lib/products/service';

export const runtime = 'nodejs';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

/** GET /api/admin/products/review-queue — PENDING_REVIEW products, FIFO. */
export const GET = createRoute(
  { auth: 'admin', permission: 'products.review', query: querySchema },
  async ({ query }) => {
    const result = await listReviewQueue(query.page, query.pageSize);
    return NextResponse.json({ data: result });
  }
);
