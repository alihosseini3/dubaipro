import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createRoute } from '@/lib/api/handler';
import { listNotifications } from '@/lib/notifications/service';

export const runtime = 'nodejs';

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  unreadOnly: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true')
});

/** GET /api/notifications — the caller's notification feed. */
export const GET = createRoute(
  { auth: 'user', query: listQuery },
  async ({ user, query }) => {
    const result = await listNotifications(user.id, query);
    return NextResponse.json({ data: result });
  }
);
