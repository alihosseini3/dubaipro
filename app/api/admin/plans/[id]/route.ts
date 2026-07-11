import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

import { createRoute } from '@/lib/api/handler';
import { planUpdateSchema } from '@/lib/subscriptions/schemas';
import {
  updatePlan,
  SubscriptionError,
  PLANS_CACHE_TAG
} from '@/lib/subscriptions/service';

export const runtime = 'nodejs';

/** PATCH /api/admin/plans/[id] — edit a plan (SUPER_ADMIN via plans.manage). */
export const PATCH = createRoute(
  {
    auth: 'admin',
    permission: 'plans.manage',
    body: planUpdateSchema,
    audit: { action: 'plan.update', entityType: 'SubscriptionPlan' }
  },
  async ({ params, body, audit }) => {
    try {
      const id = String(params.id);
      const plan = await updatePlan(id, {
        ...body,
        features: body.features === undefined ? undefined : (body.features ?? null)
      });
      audit.entityId = id;
      revalidateTag(PLANS_CACHE_TAG);
      return NextResponse.json({ data: plan });
    } catch (error) {
      if (error instanceof SubscriptionError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
  }
);
