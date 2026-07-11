import { NextResponse } from 'next/server';

import { createRoute } from '@/lib/api/handler';
import { replaceVariantsSchema } from '@/lib/products/schemas';
import { replaceVariants, ProductError } from '@/lib/products/service';

export const runtime = 'nodejs';

/** PUT /api/supplier/products/[id]/variants — replace the full variant set. */
export const PUT = createRoute(
  {
    auth: 'supplier',
    permission: 'supplier.products.write',
    body: replaceVariantsSchema,
    rateLimit: { key: 'product-write', limit: 30, windowSeconds: 60 },
    audit: { action: 'product.variants.replace', entityType: 'Product' }
  },
  async ({ supplier, params, body, audit }) => {
    try {
      const id = String(params.id);
      const variants = await replaceVariants(supplier.id, id, body);
      audit.entityId = id;
      return NextResponse.json({ data: variants });
    } catch (error) {
      if (error instanceof ProductError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
  }
);
