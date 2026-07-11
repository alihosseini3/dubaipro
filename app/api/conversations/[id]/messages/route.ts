import { NextResponse } from 'next/server';

import { createRoute } from '@/lib/api/handler';
import { messagesQuerySchema, sendMessageSchema } from '@/lib/messaging/schemas';
import { listMessages, MessagingError, sendMessage } from '@/lib/messaging/service';

export const runtime = 'nodejs';

/**
 * GET /api/conversations/[id]/messages — thread messages, asc. Pass
 * `?after=<ISO>` to fetch only newer messages (5s polling delta).
 */
export const GET = createRoute(
  { auth: 'user', query: messagesQuerySchema },
  async ({ user, params, query }) => {
    try {
      const messages = await listMessages(String(params.id), user.id, {
        after: query.after
      });
      return NextResponse.json({ data: messages });
    } catch (error) {
      if (error instanceof MessagingError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
  }
);

/** POST /api/conversations/[id]/messages — send a message. */
export const POST = createRoute(
  {
    auth: 'user',
    body: sendMessageSchema,
    rateLimit: { key: 'message-send', limit: 60, windowSeconds: 60 }
  },
  async ({ user, params, body }) => {
    try {
      const message = await sendMessage({
        conversationId: String(params.id),
        senderId: user.id,
        content: body.content,
        attachments: body.attachments
      });
      return NextResponse.json({ data: message }, { status: 201 });
    } catch (error) {
      if (error instanceof MessagingError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
  }
);
