import { NextResponse } from 'next/server';

import { createRoute } from '@/lib/api/handler';
import {
  supplierProductSchema,
  supplierProductListQuerySchema
} from '@/lib/products/schemas';
import {
  createSupplierProduct,
  listSupplierProducts,
  ProductError
} from '@/lib/products/service';
import { PlanLimitError } from '@/lib/subscriptions/limits';

export const runtime = 'nodejs';

/** POST /api/supplier/products — create a product (starts in DRAFT). */
export const POST = createRoute(
  {
    auth: 'supplier',
    permission: 'supplier.products.write',
    body: supplierProductSchema,
    rateLimit: { key: 'product-write', limit: 30, windowSeconds: 60 },
    audit: { action: 'product.create', entityType: 'Product' }
  },
  async ({ supplier, body, audit }) => {
    try {
      const product = await createSupplierProduct(supplier.id, body);
      audit.entityId = product.id;
      return NextResponse.json({ data: product }, { status: 201 });
    } catch (error) {
      if (error instanceof PlanLimitError) {
        return NextResponse.json(
          { error: error.message, details: { used: String(error.used), limit: String(error.limit) } },
          { status: error.status }
        );
      }
      if (error instanceof ProductError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
  }
);

/** GET /api/supplier/products — own products, filterable by status. */
export const GET = createRoute(
  {
    auth: 'supplier',
    query: supplierProductListQuerySchema
  },
  async ({ supplier, query }) => {
    const result = await listSupplierProducts(supplier.id, query);
    return NextResponse.json({ data: result });
  }
);
