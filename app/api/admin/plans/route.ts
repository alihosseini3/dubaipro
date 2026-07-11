import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

import { createRoute } from '@/lib/api/handler';
import { PLANS_CACHE_TAG } from '@/lib/subscriptions/service';
import { planInputSchema } from '@/lib/subscriptions/schemas';
import {
  createPlan,
  listPlans,
  SubscriptionError
} from '@/lib/subscriptions/service';

export const runtime = 'nodejs';

/** GET /api/admin/plans — all plans, including inactive. */
export const GET = createRoute(
  { auth: 'admin', permission: 'subscriptions.manage' },
  async () => {
    const plans = await listPlans(true);
    return NextResponse.json({ data: plans });
  }
);

/** POST /api/admin/plans — create a plan (SUPER_ADMIN via plans.manage). */
export const POST = createRoute(
  {
    auth: 'admin',
    permission: 'plans.manage',
    body: planInputSchema,
    audit: { action: 'plan.create', entityType: 'SubscriptionPlan' }
  },
  async ({ body, audit }) => {
    try {
      const plan = await createPlan({ ...body, features: body.features ?? null });
      audit.entityId = plan.id;
      revalidateTag(PLANS_CACHE_TAG);
      return NextResponse.json({ data: plan }, { status: 201 });
    } catch (error) {
      if (error instanceof SubscriptionError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
  }
);
