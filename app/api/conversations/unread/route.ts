import { NextResponse } from 'next/server';

import { createRoute } from '@/lib/api/handler';
import { getUnreadTotal } from '@/lib/messaging/service';

export const runtime = 'nodejs';

/** GET /api/conversations/unread — global unread badge for the header. */
export const GET = createRoute({ auth: 'user' }, async ({ user }) => {
  const total = await getUnreadTotal(user.id);
  return NextResponse.json({ data: { total } });
});
