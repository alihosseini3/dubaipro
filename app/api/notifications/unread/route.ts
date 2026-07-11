import { NextResponse } from 'next/server';

import { createRoute } from '@/lib/api/handler';
import { getUnreadNotificationCount } from '@/lib/notifications/service';

export const runtime = 'nodejs';

/** GET /api/notifications/unread — header-bell badge count. */
export const GET = createRoute({ auth: 'user' }, async ({ user }) => {
  const total = await getUnreadNotificationCount(user.id);
  return NextResponse.json({ data: { total } });
});
