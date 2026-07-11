import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createRoute } from '@/lib/api/handler';
import { listConversationsForAdmin } from '@/lib/messaging/service';

export const runtime = 'nodejs';

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  supplierId: z.string().optional()
});

/**
 * GET /api/admin/conversations — oversight list. Gated by
 * 'conversations.oversee' (SUPER_ADMIN in the current matrix).
 */
export const GET = createRoute(
  { auth: 'admin', permission: 'conversations.oversee', query: listQuery },
  async ({ query }) => {
    const result = await listConversationsForAdmin(query);
    return NextResponse.json({ data: result });
  }
);
