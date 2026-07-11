import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createRoute } from '@/lib/api/handler';
import { sampleCreateSchema } from '@/lib/messaging/schemas';
import { createSampleRequest, listBuyerSamples, SampleError } from '@/lib/samples/service';

export const runtime = 'nodejs';

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20)
});

/** POST /api/samples — buyer requests a product sample. */
export const POST = createRoute(
  {
    auth: 'user',
    body: sampleCreateSchema,
    rateLimit: { key: 'sample-create', limit: 10, windowSeconds: 3600 },
    audit: { action: 'sample.create', entityType: 'SampleRequest' }
  },
  async ({ user, body, audit }) => {
    try {
      const sample = await createSampleRequest(user.id, body);
      audit.entityId = sample.id;
      audit.supplierId = sample.supplier.id;
      return NextResponse.json({ data: sample }, { status: 201 });
    } catch (error) {
      if (error instanceof SampleError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
  }
);

/** GET /api/samples — the buyer's own sample requests. */
export const GET = createRoute(
  { auth: 'user', query: listQuery },
  async ({ user, query }) => {
    const result = await listBuyerSamples(user.id, query.page, query.pageSize);
    return NextResponse.json({ data: result });
  }
);
