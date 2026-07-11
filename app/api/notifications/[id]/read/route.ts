import { NextResponse } from 'next/server';

import { createRoute } from '@/lib/api/handler';
import { markNotificationRead } from '@/lib/notifications/service';

export const runtime = 'nodejs';

/** POST /api/notifications/[id]/read — mark one notification read (own only). */
export const POST = createRoute({ auth: 'user' }, async ({ user, params }) => {
  await markNotificationRead(user.id, String(params.id));
  return NextResponse.json({ data: { ok: true } });
});
