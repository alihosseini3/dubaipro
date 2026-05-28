import { NextResponse } from 'next/server';

import { serverError } from '@/lib/api/errors';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import { getMarketingOverview } from '@/lib/marketing/segments';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const days = Math.min(parseInt(searchParams.get('days') ?? '30', 10), 365);

  try {
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);

    const [overview, campaignBreakdown, automationBreakdown] = await Promise.all([
      getMarketingOverview(),
      // Per-campaign engagement for completed campaigns in the window.
      prisma.campaign.findMany({
        where: {
          status: 'COMPLETED',
          sentAt: { gte: since },
        },
        select: {
          id: true,
          name: true,
          channel: true,
          totalSent: true,
          totalOpened: true,
          totalClicked: true,
          totalFailed: true,
          sentAt: true,
        },
        orderBy: { sentAt: 'desc' },
        take: 50,
      }),
      // Automation log breakdown (sent/failed/skipped) per event in window.
      prisma.automationLog.groupBy({
        by: ['eventType', 'channel', 'status'],
        _count: { id: true },
        where: { createdAt: { gte: since } },
        orderBy: [{ eventType: 'asc' }, { channel: 'asc' }],
      }),
    ]);

    return NextResponse.json({
      data: {
        overview,
        campaigns: campaignBreakdown.map((c) => ({
          ...c,
          openRate: c.totalSent > 0 ? Math.round((c.totalOpened / c.totalSent) * 100) : 0,
          clickRate: c.totalSent > 0 ? Math.round((c.totalClicked / c.totalSent) * 100) : 0,
        })),
        automation: automationBreakdown,
        periodDays: days,
      },
    });
  } catch (err) {
    console.error('GET /api/admin/marketing/analytics failed:', err);
    return serverError();
  }
}
