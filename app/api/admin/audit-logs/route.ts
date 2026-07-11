import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createRoute } from '@/lib/api/handler';
import { listAuditLogs } from '@/lib/audit/query';

export const runtime = 'nodejs';

const querySchema = z.object({
  action: z.string().trim().max(80).optional(),
  entityType: z.string().trim().max(40).optional(),
  supplierId: z.string().trim().max(60).optional(),
  actorId: z.string().trim().max(60).optional(),
  cursor: z.string().trim().max(60).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(30)
});

/** GET /api/admin/audit-logs — cursor-paginated audit trail with filters. */
export const GET = createRoute(
  { auth: 'admin', permission: 'audit.read', query: querySchema },
  async ({ query }) => {
    const result = await listAuditLogs({ ...query, cursor: query.cursor ?? null });
    return NextResponse.json({ data: result });
  }
);
