import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/marketing/track/open?cid=<campaignId>&uid=<userId>
 *
 * 1x1 transparent GIF pixel embedded in campaign emails.
 * Records the first open per recipient and increments the
 * campaign counter (atomic upsert pattern).
 */
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const campaignId = searchParams.get('cid');
  const userId = searchParams.get('uid') || null;

  if (campaignId) {
    // Fire-and-forget — don't block the pixel response.
    void (async () => {
      try {
        const updated = await prisma.campaignRecipient.updateMany({
          where: {
            campaignId,
            ...(userId ? { userId } : {}),
            openedAt: null,
          },
          data: { openedAt: new Date(), status: 'OPENED' },
        });
        if (updated.count > 0) {
          await prisma.campaign.update({
            where: { id: campaignId },
            data: { totalOpened: { increment: 1 } },
          });
        }
      } catch {
        // Tracking errors must never bubble.
      }
    })();
  }

  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
    },
  });
}
