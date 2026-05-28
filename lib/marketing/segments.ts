/**
 * Segment query helpers — returns user counts and sample lists for
 * each CustomerSegment so the admin UI can show audience sizes before
 * launching a campaign.
 */

import { CustomerSegment } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type SegmentStats = {
  segment: CustomerSegment;
  count: number;
  emailCount: number;
  whatsappCount: number;
};

/**
 * Returns per-segment audience sizes.
 * Runs 3 queries in parallel (metrics count + email count + WA count).
 */
export async function getSegmentStats(): Promise<SegmentStats[]> {
  const segments: CustomerSegment[] = [
    CustomerSegment.ALL,
    CustomerSegment.NEW,
    CustomerSegment.REPEAT,
    CustomerSegment.HIGH_VALUE,
    CustomerSegment.INACTIVE,
  ];

  const results = await Promise.all(
    segments.map(async (seg) => {
      const where = seg === CustomerSegment.ALL ? {} : { metrics: { segment: seg } };
      const [count, emailCount, whatsappCount] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.count({ where: { ...where, email: { not: '' } } }),
        prisma.user.count({
          where: { ...where, addresses: { some: { phone: { not: '' } } } },
        }),
      ]);
      return { segment: seg, count, emailCount, whatsappCount };
    }),
  );

  return results;
}

/**
 * Returns a small sample (max 10) of user names for a given segment —
 * used in the UI "preview audience" feature.
 */
export async function sampleSegment(
  segment: CustomerSegment | null,
  limit = 10,
): Promise<{ id: string; name: string; email: string }[]> {
  const where = segment && segment !== CustomerSegment.ALL
    ? { metrics: { segment } }
    : {};

  return prisma.user.findMany({
    where,
    select: { id: true, name: true, email: true },
    take: limit,
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Returns counts for a quick analytics overview used on the
 * marketing dashboard.
 */
export async function getMarketingOverview() {
  const [totalUsers, totalCampaigns, campaignStats, recentLogs] =
    await Promise.all([
      prisma.user.count(),
      prisma.campaign.count(),
      prisma.campaign.aggregate({
        _sum: {
          totalSent: true,
          totalOpened: true,
          totalClicked: true,
        },
      }),
      prisma.automationLog.groupBy({
        by: ['eventType'],
        _count: { id: true },
        where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) } },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
    ]);

  const totalSent = Number(campaignStats._sum.totalSent ?? 0);
  const totalOpened = Number(campaignStats._sum.totalOpened ?? 0);
  const totalClicked = Number(campaignStats._sum.totalClicked ?? 0);

  return {
    totalUsers,
    totalCampaigns,
    totalSent,
    openRate: totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0,
    clickRate: totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0,
    recentLogs,
  };
}
