import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth/session';
import { ChatError, listMessages } from '@/lib/chat/service';
import { handlePrismaError, notFound } from '@/lib/api/errors';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ conversationId: string }> };

export async function GET(_request: Request, context: Ctx) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { conversationId } = await context.params;

  try {
    const messages = await listMessages(conversationId, user.id);
    return NextResponse.json({ data: messages });
  } catch (error) {
    if (error instanceof ChatError) {
      if (error.code === 'not_found') return notFound('Conversation not found');
      if (error.code === 'forbidden') {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      }
    }
    return handlePrismaError(error, 'GET /api/chat/[conversationId]');
  }
}
