import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/marketing/track/click?cid=<campaignId>&uid=<userId>&url=<dest>
 *
 * Wrapped link embedded in campaign messages. Tracks first click per
 * recipient then redirects to `url`.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const campaignId = searchParams.get('cid');
  const userId = searchParams.get('uid') || null;
  const url = searchParams.get('url') ?? '/';

  if (campaignId) {
    void (async () => {
      try {
        const updated = await prisma.campaignRecipient.updateMany({
          where: {
            campaignId,
            ...(userId ? { userId } : {}),
            clickedAt: null,
          },
          data: { clickedAt: new Date(), status: 'CLICKED' },
        });
        if (updated.count > 0) {
          await prisma.campaign.update({
            where: { id: campaignId },
            data: { totalClicked: { increment: 1 } },
          });
        }
      } catch {
        // Tracking errors must never bubble.
      }
    })();
  }

  return NextResponse.redirect(url, 302);
}
