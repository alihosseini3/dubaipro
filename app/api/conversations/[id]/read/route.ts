import { NextResponse } from 'next/server';

import { createRoute } from '@/lib/api/handler';
import { markRead, MessagingError } from '@/lib/messaging/service';

export const runtime = 'nodejs';

/** POST /api/conversations/[id]/read — zero the caller's unread counter. */
export const POST = createRoute({ auth: 'user' }, async ({ user, params }) => {
  try {
    await markRead(String(params.id), user.id);
    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    if (error instanceof MessagingError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
});
