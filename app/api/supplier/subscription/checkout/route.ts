import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createRoute } from '@/lib/api/handler';
import { getBaseUrl } from '@/lib/api/base-url';
import { PaymentError } from '@/lib/payments/types';
import { startSubscriptionCheckout } from '@/lib/subscriptions/billing';
import { SubscriptionError } from '@/lib/subscriptions/service';

export const runtime = 'nodejs';

const bodySchema = z.object({
  planId: z.string().min(1),
  /** Payment method code from the catalog (STRIPE, BANK_TRANSFER, …). */
  method: z.string().trim().min(2).max(32),
  locale: z
    .string()
    .regex(/^[a-z]{2}$/)
    .default('en')
});

/**
 * POST /api/supplier/subscription/checkout — start a paid plan purchase.
 * Hosted gateways return a redirectUrl; manual transfers return the bank
 * details inline and wait for admin approval.
 */
export const POST = createRoute(
  {
    auth: 'supplier',
    permission: 'supplier.subscription.view',
    body: bodySchema,
    rateLimit: { key: 'subscription-checkout', limit: 10, windowSeconds: 600 },
    audit: { action: 'subscription.checkout', entityType: 'SubscriptionInvoice' }
  },
  async ({ supplier, user, body, audit }) => {
    try {
      const result = await startSubscriptionCheckout({
        supplierId: supplier.id,
        userId: user.id,
        userEmail: user.email,
        planId: body.planId,
        method: body.method,
        baseUrl: await getBaseUrl(),
        locale: body.locale
      });
      audit.entityId = result.invoiceId;
      return NextResponse.json({ data: result }, { status: 201 });
    } catch (error) {
      if (error instanceof SubscriptionError || error instanceof PaymentError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.status }
        );
      }
      throw error;
    }
  }
);
