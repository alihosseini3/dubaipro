import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createRoute } from '@/lib/api/handler';
import { listSupplierSamples } from '@/lib/samples/service';

export const runtime = 'nodejs';

const listQuery = z.object({
  status: z.enum(['PENDING', 'ACCEPTED', 'DECLINED', 'SHIPPED', 'CLOSED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20)
});

/** GET /api/supplier/samples — org sample queue, filterable by status. */
export const GET = createRoute(
  { auth: 'supplier', permission: 'supplier.samples.manage', query: listQuery },
  async ({ supplier, query }) => {
    const result = await listSupplierSamples(supplier.id, query);
    return NextResponse.json({ data: result });
  }
);
