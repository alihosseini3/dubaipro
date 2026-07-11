import { NextResponse } from 'next/server';

import { createRoute } from '@/lib/api/handler';
import { adminReviewSchema } from '@/lib/products/schemas';
import { reviewProduct, ProductError } from '@/lib/products/service';

export const runtime = 'nodejs';

/**
 * POST /api/admin/products/[id]/review — approve or reject a submission.
 * Reject requires a reason (shown to the supplier). Approving is also how an
 * admin re-publishes a previously rejected product after resubmission.
 */
export const POST = createRoute(
  {
    auth: 'admin',
    permission: 'products.review',
    body: adminReviewSchema,
    audit: { action: 'product.review', entityType: 'Product' }
  },
  async ({ user, params, body, audit }) => {
    try {
      const id = String(params.id);
      const product = await reviewProduct(user.id, id, body.action, body.reason);
      audit.entityId = id;
      audit.supplierId = product.supplierId;
      audit.diff = {
        after: {
          status: product.status,
          ...(body.action === 'reject' ? { reason: body.reason } : {})
        }
      };
      return NextResponse.json({ data: product });
    } catch (error) {
      if (error instanceof ProductError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
  }
);
