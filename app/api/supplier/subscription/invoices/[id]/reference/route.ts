import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createRoute } from '@/lib/api/handler';
import { submitInvoiceReference } from '@/lib/subscriptions/billing';
import { SubscriptionError } from '@/lib/subscriptions/service';

export const runtime = 'nodejs';

const bodySchema = z.object({
  referenceNumber: z.string().trim().min(3).max(128)
});

/**
 * POST /api/supplier/subscription/invoices/[id]/reference — attach the
 * bank-transfer tracking number so the admin can match the payment.
 */
export const POST = createRoute(
  {
    auth: 'supplier',
    permission: 'supplier.subscription.view',
    body: bodySchema,
    audit: { action: 'subscription.invoice.reference', entityType: 'SubscriptionInvoice' }
  },
  async ({ supplier, params, body, audit }) => {
    try {
      const id = String(params.id);
      await submitInvoiceReference(supplier.id, id, body.referenceNumber);
      audit.entityId = id;
      return NextResponse.json({ data: { ok: true } });
    } catch (error) {
      if (error instanceof SubscriptionError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
  }
);
