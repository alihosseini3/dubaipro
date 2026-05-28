import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth/session';
import { ChatError, sendMessage } from '@/lib/chat/service';
import { badRequest, handlePrismaError, notFound } from '@/lib/api/errors';
import { isNonEmptyString, parseJsonBody } from '@/lib/api/validation';

export const runtime = 'nodejs';

type Body = { conversationId?: unknown; content?: unknown };

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const parsed = await parseJsonBody<Body>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const { conversationId, content } = parsed.data;

  if (!isNonEmptyString(conversationId)) {
    return badRequest('conversationId is required');
  }
  if (typeof content !== 'string') return badRequest('content is required');

  try {
    const message = await sendMessage({
      conversationId,
      senderId: user.id,
      content
    });
    return NextResponse.json({ data: message }, { status: 201 });
  } catch (error) {
    if (error instanceof ChatError) {
      if (error.code === 'not_found') return notFound('Conversation not found');
      if (error.code === 'forbidden') {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      }
      if (error.code === 'invalid_content') return badRequest('invalid_content');
    }
    return handlePrismaError(error, 'POST /api/chat/send');
  }
}
