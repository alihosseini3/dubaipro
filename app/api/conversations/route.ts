import { NextResponse } from 'next/server';

import { createRoute } from '@/lib/api/handler';
import {
  conversationListQuerySchema,
  startConversationSchema
} from '@/lib/messaging/schemas';
import {
  findOrCreateDirectConversation,
  listConversations,
  MessagingError
} from '@/lib/messaging/service';

export const runtime = 'nodejs';

/** GET /api/conversations — the caller's inbox (member-based). */
export const GET = createRoute(
  { auth: 'user', query: conversationListQuerySchema },
  async ({ user, query }) => {
    const result = await listConversations(user.id, query);
    return NextResponse.json({ data: result });
  }
);

/** POST /api/conversations — start (or reopen) a DIRECT thread with a supplier. */
export const POST = createRoute(
  {
    auth: 'user',
    body: startConversationSchema,
    rateLimit: { key: 'conversation-start', limit: 20, windowSeconds: 3600 },
    audit: { action: 'conversation.start', entityType: 'Conversation' }
  },
  async ({ user, body, audit }) => {
    try {
      const conversation = await findOrCreateDirectConversation({
        buyerId: user.id,
        supplierId: body.supplierId,
        productId: body.productId
      });
      audit.entityId = conversation.id;
      return NextResponse.json({ data: { id: conversation.id } }, { status: 201 });
    } catch (error) {
      if (error instanceof MessagingError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
  }
);
