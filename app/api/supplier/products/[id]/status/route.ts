import { NextResponse } from 'next/server';

import { createRoute } from '@/lib/api/handler';
import { productStatusActionSchema } from '@/lib/products/schemas';
import { applySupplierStatusAction, ProductError } from '@/lib/products/service';

export const runtime = 'nodejs';

/**
 * POST /api/supplier/products/[id]/status — supplier-side workflow actions:
 * submit (→ PENDING_REVIEW), archive, unarchive. Admin approve/reject lives
 * in /api/admin/products/[id]/review.
 */
export const POST = createRoute(
  {
    auth: 'supplier',
    permission: 'supplier.products.write',
    body: productStatusActionSchema,
    audit: { action: 'product.status', entityType: 'Product' }
  },
  async ({ supplier, params, body, audit }) => {
    try {
      const id = String(params.id);
      const product = await applySupplierStatusAction(supplier.id, id, body.action);
      audit.entityId = id;
      audit.diff = { after: { status: product.status } };
      return NextResponse.json({ data: product });
    } catch (error) {
      if (error instanceof ProductError) {
        // `code` carries the GateReason so the client can render the right
        // "your application is still pending / was rejected" banner.
        return NextResponse.json(
          { error: error.message, ...(error.code ? { code: error.code } : {}) },
          { status: error.status }
        );
      }
      throw error;
    }
  }
);
