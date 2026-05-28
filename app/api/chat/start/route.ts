import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth/session';
import { ChatError, startConversation } from '@/lib/chat/service';
import { badRequest, handlePrismaError, notFound } from '@/lib/api/errors';
import { isNonEmptyString, parseJsonBody } from '@/lib/api/validation';

export const runtime = 'nodejs';

type Body = { peerId?: unknown };

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const parsed = await parseJsonBody<Body>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const { peerId } = parsed.data;

  if (!isNonEmptyString(peerId)) return badRequest('peerId is required');

  try {
    const convo = await startConversation(user.id, peerId);
    if (!convo) return notFound('Conversation not found');
    return NextResponse.json({ data: { id: convo.id } });
  } catch (error) {
    if (error instanceof ChatError) {
      if (error.code === 'peer_not_found') return notFound('Peer not found');
      if (error.code === 'invalid_peer' || error.code === 'self_chat') {
        return badRequest(error.code);
      }
    }
    return handlePrismaError(error, 'POST /api/chat/start');
  }
}
