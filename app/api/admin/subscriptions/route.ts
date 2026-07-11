import { NextResponse } from 'next/server';

import { createRoute } from '@/lib/api/handler';
import { subscriptionListQuerySchema } from '@/lib/subscriptions/schemas';
import { listSupplierSubscriptions } from '@/lib/subscriptions/service';

export const runtime = 'nodejs';

/** GET /api/admin/subscriptions — suppliers with their current plan. */
export const GET = createRoute(
  {
    auth: 'admin',
    permission: 'subscriptions.manage',
    query: subscriptionListQuerySchema
  },
  async ({ query }) => {
    const result = await listSupplierSubscriptions(query);
    return NextResponse.json({ data: result });
  }
);
