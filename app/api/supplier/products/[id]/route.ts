import { NextResponse } from 'next/server';

import { createRoute } from '@/lib/api/handler';
import { supplierProductUpdateSchema } from '@/lib/products/schemas';
import {
  getSupplierProduct,
  updateSupplierProduct,
  ProductError
} from '@/lib/products/service';

export const runtime = 'nodejs';

/** GET /api/supplier/products/[id] — own product with tiers, variants, specs. */
export const GET = createRoute({ auth: 'supplier' }, async ({ supplier, params }) => {
  try {
    const product = await getSupplierProduct(supplier.id, String(params.id));
    return NextResponse.json({ data: product });
  } catch (error) {
    if (error instanceof ProductError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
});

/** PATCH /api/supplier/products/[id] — update own product fields. */
export const PATCH = createRoute(
  {
    auth: 'supplier',
    permission: 'supplier.products.write',
    body: supplierProductUpdateSchema,
    rateLimit: { key: 'product-write', limit: 30, windowSeconds: 60 },
    audit: { action: 'product.update', entityType: 'Product' }
  },
  async ({ supplier, params, body, audit }) => {
    try {
      const product = await updateSupplierProduct(
        supplier.id,
        String(params.id),
        body
      );
      audit.entityId = product.id;
      return NextResponse.json({ data: product });
    } catch (error) {
      if (error instanceof ProductError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
  }
);
