import { NextResponse } from 'next/server';

import { createRoute } from '@/lib/api/handler';
import { archiveSchema } from '@/lib/messaging/schemas';
import { MessagingError, setArchived } from '@/lib/messaging/service';

export const runtime = 'nodejs';

/** POST /api/conversations/[id]/archive — archive/unarchive for the caller only. */
export const POST = createRoute(
  { auth: 'user', body: archiveSchema },
  async ({ user, params, body }) => {
    try {
      await setArchived(String(params.id), user.id, body.archived);
      return NextResponse.json({ data: { archived: body.archived } });
    } catch (error) {
      if (error instanceof MessagingError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
  }
);
