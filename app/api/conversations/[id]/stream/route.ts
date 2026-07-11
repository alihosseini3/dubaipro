import { getCurrentUser } from '@/lib/auth/session';
import {
  assertConversationAccess,
  MessagingError
} from '@/lib/messaging/service';
import {
  conversationEmitter,
  type ConversationMessageEvent
} from '@/lib/messaging/emitter';

/**
 * SSE stream for one conversation — same transport as the proven auction
 * stream (in-process emitter). Membership is asserted BEFORE the stream
 * opens; REST remains the canonical write path, so a dropped stream only
 * delays a message until the client's fallback poll.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEARTBEAT_MS = 25_000;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await context.params;

  const user = await getCurrentUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  try {
    await assertConversationAccess(conversationId, user.id);
  } catch (error) {
    const status = error instanceof MessagingError ? error.status : 500;
    return new Response('Forbidden', { status });
  }

  const channel = `conversation:${conversationId}`;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: ConversationMessageEvent) => {
        try {
          controller.enqueue(
            encoder.encode(`event: message\ndata: ${JSON.stringify(event.message)}\n\n`)
          );
        } catch {
          cleanup();
        }
      };
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          cleanup();
        }
      }, HEARTBEAT_MS);

      const cleanup = () => {
        clearInterval(heartbeat);
        conversationEmitter.off(channel, send);
      };

      conversationEmitter.on(channel, send);
      request.signal.addEventListener('abort', () => {
        cleanup();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  });
}
