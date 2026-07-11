import { NextResponse } from 'next/server';

import { createRoute } from '@/lib/api/handler';
import { searchQuerySchema } from '@/lib/messaging/schemas';
import { searchMessages } from '@/lib/messaging/service';

export const runtime = 'nodejs';

/**
 * GET /api/conversations/search?q= — full-text search over the caller's own
 * messages (Postgres FTS, scoped by membership in the SQL join).
 */
export const GET = createRoute(
  {
    auth: 'user',
    query: searchQuerySchema,
    rateLimit: { key: 'message-search', limit: 30, windowSeconds: 60 }
  },
  async ({ user, query }) => {
    const hits = await searchMessages(user.id, query.q);
    return NextResponse.json({ data: hits });
  }
);
