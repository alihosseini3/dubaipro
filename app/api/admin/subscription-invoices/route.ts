import { NextResponse } from 'next/server';
import { z } from 'zod';
import { PaymentStatus } from '@prisma/client';

import { createRoute } from '@/lib/api/handler';
import { listInvoices } from '@/lib/subscriptions/billing';

export const runtime = 'nodejs';

const querySchema = z.object({
  status: z.enum(PaymentStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

/** GET /api/admin/subscription-invoices — invoice list (default: all). */
export const GET = createRoute(
  { auth: 'admin', permission: 'subscriptions.manage', query: querySchema },
  async ({ query }) => {
    const result = await listInvoices(query);
    return NextResponse.json({ data: result });
  }
);
