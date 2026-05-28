import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const POLL_MS = 4000;
const HEARTBEAT_MS = 25000;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * SSE stream for a single RFQ detail page.
 * Emits:
 *   { type: 'new_message' }           — new message in any thread of this RFQ
 *   { type: 'status_changed', status } — RFQ status changed
 *   { type: 'quote_update' }           — quote count changed
 *   { type: 'heartbeat' }              — keep-alive ping
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const enc = new TextEncoder();

  const send = (ctrl: ReadableStreamDefaultController, data: object) => {
    try {
      ctrl.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
    } catch { /* client disconnected */ }
  };

  const stream = new ReadableStream({
    async start(ctrl) {
      send(ctrl, { type: 'connected' });

      let lastMsgId: string | null = null;
      let lastStatus: string | null = null;
      let lastQuoteCount = -1;
      let heartbeatTimer: ReturnType<typeof setInterval>;

      // Heartbeat to prevent proxy/CDN timeout
      heartbeatTimer = setInterval(() => {
        send(ctrl, { type: 'heartbeat' });
      }, HEARTBEAT_MS);

      try {
        while (true) {
          if (req.signal.aborted) break;

          const rfq = await prisma.rfqRequest.findUnique({
            where: { slug },
            select: {
              status: true,
              quoteCount: true,
              messages: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: { id: true },
              },
            },
          });

          if (rfq) {
            if (rfq.status !== lastStatus) {
              if (lastStatus !== null) send(ctrl, { type: 'status_changed', status: rfq.status });
              lastStatus = rfq.status;
            }

            const latestId = rfq.messages[0]?.id ?? null;
            if (latestId && latestId !== lastMsgId) {
              if (lastMsgId !== null) send(ctrl, { type: 'new_message' });
              lastMsgId = latestId;
            }

            if (lastQuoteCount !== -1 && rfq.quoteCount !== lastQuoteCount) {
              send(ctrl, { type: 'quote_update', count: rfq.quoteCount });
            }
            lastQuoteCount = rfq.quoteCount;
          }

          await sleep(POLL_MS);
        }
      } finally {
        clearInterval(heartbeatTimer);
        try { ctrl.close(); } catch { /* already closed */ }
      }
    },
    cancel() { /* req.signal.aborted will break the loop */ },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // disable nginx buffering
    },
  });
}
