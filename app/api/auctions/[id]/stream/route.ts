/**
 * GET /api/auctions/[id]/stream
 *
 * Server-Sent Events endpoint for realtime auction updates.
 * Clients subscribe and receive `bid` and `watch` events.
 */
import type { AuctionEvent } from '@/lib/auctions/emitter';
import { auctionEmitter } from '@/lib/auctions/emitter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const channel = `auction:${id}`;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      /* Send initial keepalive so the browser knows the connection is live. */
      controller.enqueue(encoder.encode(': connected\n\n'));

      function send(event: AuctionEvent) {
        try {
          const data = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
        } catch {
          /* Client disconnected — remove listener on next tick. */
          cleanup();
        }
      }

      function heartbeat() {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          cleanup();
        }
      }

      const pingInterval = setInterval(heartbeat, 25_000);

      function cleanup() {
        clearInterval(pingInterval);
        auctionEmitter.off(channel, send);
      }

      auctionEmitter.on(channel, send);

      /* Store cleanup on the controller so cancel() can call it. */
      (controller as unknown as { _cleanup: () => void })._cleanup = cleanup;
    },
    cancel(controller) {
      const c = controller as unknown as { _cleanup?: () => void };
      c._cleanup?.();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    }
  });
}
