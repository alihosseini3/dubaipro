import { NextResponse } from 'next/server';

import { createRoute } from '@/lib/api/handler';
import { getConversationForAdmin, MessagingError } from '@/lib/messaging/service';

export const runtime = 'nodejs';

/** GET /api/admin/conversations/[id] — read-only full thread (oversight). */
export const GET = createRoute(
  {
    auth: 'admin',
    permission: 'conversations.oversee',
    audit: { action: 'conversation.oversee', entityType: 'Conversation' }
  },
  async ({ params, audit }) => {
    try {
      const conversation = await getConversationForAdmin(String(params.id));
      audit.entityId = conversation.id;
      return NextResponse.json({ data: conversation });
    } catch (error) {
      if (error instanceof MessagingError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
  }
);
