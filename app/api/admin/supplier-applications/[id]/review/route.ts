import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createRoute } from '@/lib/api/handler';
import {
  approveApplication,
  rejectApplication,
  OnboardingError
} from '@/lib/suppliers/onboarding';

export const runtime = 'nodejs';

const bodySchema = z
  .object({
    action: z.enum(['approve', 'reject']),
    /** Required on reject — shown to the supplier so they know what to fix. */
    reason: z.string().trim().max(1000).optional()
  })
  .refine((v) => v.action !== 'reject' || (v.reason && v.reason.length >= 3), {
    message: 'A rejection reason is required',
    path: ['reason']
  });

/**
 * POST /api/admin/supplier-applications/[id]/review
 *
 * The one atomic approve/reject decision. Approving activates the account and
 * grants product-listing rights in a single transaction (previously four
 * disconnected toggles that never granted listing rights at all).
 */
export const POST = createRoute(
  {
    auth: 'admin',
    permission: 'suppliers.manage',
    body: bodySchema,
    audit: { action: 'supplier.application.review', entityType: 'Supplier' }
  },
  async ({ user, params, body, audit }) => {
    try {
      const supplierId = String(params.id);
      const updated =
        body.action === 'approve'
          ? await approveApplication({
              supplierId,
              adminId: user.id,
              note: body.reason ?? null
            })
          : await rejectApplication({
              supplierId,
              adminId: user.id,
              reason: body.reason as string
            });

      audit.entityId = supplierId;
      audit.supplierId = supplierId;
      audit.diff = {
        after: {
          onboardingStatus: updated.onboardingStatus,
          status: updated.status,
          canListProducts: updated.canListProducts,
          ...(body.action === 'reject' ? { reason: body.reason } : {})
        }
      };
      return NextResponse.json({ data: updated });
    } catch (error) {
      if (error instanceof OnboardingError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
  }
);
