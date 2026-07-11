import { NextResponse } from 'next/server';

import { createRoute } from '@/lib/api/handler';
import { listMessages, MessagingError } from '@/lib/messaging/service';

export const runtime = 'nodejs';

/** LEGACY-compatible message list. New UI uses /api/conversations/[id]/messages. */
export const GET = createRoute({ auth: 'user' }, async ({ user, params }) => {
  try {
    const messages = await listMessages(String(params.conversationId), user.id);
    return NextResponse.json({ data: messages });
  } catch (error) {
    if (error instanceof MessagingError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
});
