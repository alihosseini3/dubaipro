import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createRoute } from '@/lib/api/handler';
import { approveInvoice, rejectInvoice } from '@/lib/subscriptions/billing';
import { SubscriptionError } from '@/lib/subscriptions/service';

export const runtime = 'nodejs';

const bodySchema = z
  .object({
    action: z.enum(['approve', 'reject']),
    reason: z.string().trim().max(500).optional()
  })
  .refine((v) => v.action !== 'reject' || (v.reason && v.reason.length >= 3), {
    message: 'A rejection reason is required',
    path: ['reason']
  });

/**
 * POST /api/admin/subscription-invoices/[id]/review — approve a manual
 * transfer (activates the plan) or reject it with a reason.
 */
export const POST = createRoute(
  {
    auth: 'admin',
    permission: 'subscriptions.manage',
    body: bodySchema,
    audit: { action: 'subscription.invoice.review', entityType: 'SubscriptionInvoice' }
  },
  async ({ params, body, audit }) => {
    try {
      const id = String(params.id);
      if (body.action === 'approve') {
        await approveInvoice(id);
      } else {
        await rejectInvoice(id, body.reason);
      }
      audit.entityId = id;
      audit.diff = { after: { action: body.action, reason: body.reason ?? null } };
      return NextResponse.json({ data: { id, action: body.action } });
    } catch (error) {
      if (error instanceof SubscriptionError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
  }
);
