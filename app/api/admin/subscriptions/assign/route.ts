import { NextResponse } from 'next/server';

import { createRoute } from '@/lib/api/handler';
import { assignPlanSchema } from '@/lib/subscriptions/schemas';
import { assignPlan, SubscriptionError } from '@/lib/subscriptions/service';

export const runtime = 'nodejs';

/**
 * POST /api/admin/subscriptions/assign — manual plan assignment (billing v1:
 * admin activates after receiving payment out-of-band).
 */
export const POST = createRoute(
  {
    auth: 'admin',
    permission: 'subscriptions.manage',
    body: assignPlanSchema,
    audit: { action: 'subscription.assign', entityType: 'SupplierSubscription' }
  },
  async ({ user, body, audit }) => {
    try {
      const subscription = await assignPlan({
        adminId: user.id,
        supplierId: body.supplierId,
        planId: body.planId,
        periodMonths: body.periodMonths
      });
      audit.entityId = subscription.id;
      audit.supplierId = body.supplierId;
      audit.diff = {
        after: {
          plan: subscription.plan.code,
          periodEnd: subscription.currentPeriodEnd?.toISOString() ?? null
        }
      };
      return NextResponse.json({ data: subscription }, { status: 201 });
    } catch (error) {
      if (error instanceof SubscriptionError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
  }
);
