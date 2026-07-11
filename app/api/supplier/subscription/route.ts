import { NextResponse } from 'next/server';

import { createRoute } from '@/lib/api/handler';
import { getActiveSubscription } from '@/lib/subscriptions/service';
import { getUsageSummary } from '@/lib/subscriptions/limits';

export const runtime = 'nodejs';

/** GET /api/supplier/subscription — current plan + usage meters. */
export const GET = createRoute(
  { auth: 'supplier', permission: 'supplier.subscription.view' },
  async ({ supplier }) => {
    const [subscription, usage] = await Promise.all([
      getActiveSubscription(supplier.id),
      getUsageSummary(supplier.id)
    ]);
    return NextResponse.json({ data: { subscription, usage } });
  }
);
