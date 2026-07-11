import { NextResponse } from 'next/server';

import { createRoute } from '@/lib/api/handler';
import { markAllNotificationsRead } from '@/lib/notifications/service';

export const runtime = 'nodejs';

/** POST /api/notifications/read-all — clear the caller's unread badge. */
export const POST = createRoute({ auth: 'user' }, async ({ user }) => {
  await markAllNotificationsRead(user.id);
  return NextResponse.json({ data: { ok: true } });
});
