import { NextResponse } from 'next/server';

import { createRoute } from '@/lib/api/handler';
import { replaceTiersSchema } from '@/lib/products/schemas';
import { replaceTiers, ProductError } from '@/lib/products/service';

export const runtime = 'nodejs';

/** PUT /api/supplier/products/[id]/tiers — replace the full tier set. */
export const PUT = createRoute(
  {
    auth: 'supplier',
    permission: 'supplier.products.write',
    body: replaceTiersSchema,
    rateLimit: { key: 'product-write', limit: 30, windowSeconds: 60 },
    audit: { action: 'product.tiers.replace', entityType: 'Product' }
  },
  async ({ supplier, params, body, audit }) => {
    try {
      const id = String(params.id);
      const tiers = await replaceTiers(supplier.id, id, body.tiers);
      audit.entityId = id;
      return NextResponse.json({ data: tiers });
    } catch (error) {
      if (error instanceof ProductError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
  }
);
