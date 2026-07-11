import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createRoute } from '@/lib/api/handler';
import { MessagingError, sendMessage } from '@/lib/messaging/service';

export const runtime = 'nodejs';

const bodySchema = z.object({
  conversationId: z.string().min(1),
  content: z.string().trim().min(1).max(4000)
});

/** LEGACY-compatible send endpoint (ChatRoom). New UI posts to /api/conversations/[id]/messages. */
export const POST = createRoute(
  {
    auth: 'user',
    body: bodySchema,
    rateLimit: { key: 'message-send', limit: 60, windowSeconds: 60 }
  },
  async ({ user, body }) => {
    try {
      const message = await sendMessage({
        conversationId: body.conversationId,
        senderId: user.id,
        content: body.content
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
