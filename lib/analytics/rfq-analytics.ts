/**
 * RFQ Analytics — comprehensive metrics for the RFQ ecosystem.
 *
 * Metrics:
 *  - Funnel: DRAFT → PENDING_REVIEW → OPEN → QUOTED → ACCEPTED/EXPIRED/CANCELLED
 *  - Response rate: % of RFQs that receive at least one quote
 *  - Response time: average time from publish to first quote
 *  - Fill rate: % of RFQs that get accepted
 *  - Expiry rate: % of RFQs that expire without acceptance
 */

import 'server-only';

import { prisma } from '@/lib/prisma';

/* ─────────────────────────────────────────────────────────────────────────── */
/* Types                                                                      */
/* ─────────────────────────────────────────────────────────────────────────── */

export type RfqFunnelStage = {
  stage: string;
  count: number;
  percentage: number; // % of total created
};

export type RfqTimeBucket = {
  date: string; // ISO date YYYY-MM-DD
  created: number;
  quoted: number;
  accepted: number;
  expired: number;
};

export type SupplierResponseMetrics = {
  supplierId: string;
  supplierName: string;
  totalQuotes: number;
  acceptedQuotes: number;
  avgResponseTimeHours: number | null; // null if no quotes
  winRate: number; // % of quotes accepted
};

export type RfqAnalyticsData = {
  summary: {
    totalCreated: number;
    totalPublished: number;
    totalQuoted: number;
    totalAccepted: number;
    totalExpired: number;
    totalCancelled: number;
    responseRate: number; // % published that got at least one quote
    fillRate: number; // % published that were accepted
    expiryRate: number; // % published that expired
    avgResponseTimeHours: number | null; // avg time from publish to first quote
    avgQuotesPerRfq: number;
  };
  funnel: RfqFunnelStage[];
  timeSeries: RfqTimeBucket[];
  topSuppliers: SupplierResponseMetrics[];
};

/* ─────────────────────────────────────────────────────────────────────────── */
/* Service                                                                    */
/* ─────────────────────────────────────────────────────────────────────────── */

export async function getRfqAnalytics(
  from: Date,
  to: Date
): Promise<RfqAnalyticsData> {
  // Get all RFQs in the date range
  const rfqs = await prisma.rfqRequest.findMany({
    where: {
      createdAt: { gte: from, lt: to },
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      quoteCount: true,
      quotes: {
        where: { status: { not: 'WITHDRAWN' } },
        select: {
          id: true,
          status: true,
          createdAt: true,
          supplierId: true,
          supplier: {
            select: { name: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
      auditLogs: {
        where: { toStatus: 'OPEN' },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
        take: 1,
      },
    },
  });

  // Calculate funnel counts
  const totalCreated = rfqs.length;
  const totalPublished = rfqs.filter(
    (r) => r.status !== 'DRAFT' && r.status !== 'PENDING_REVIEW'
  ).length;
  const totalQuoted = rfqs.filter(
    (r) => r.status === 'QUOTED' || r.status === 'NEGOTIATING' || r.status === 'ACCEPTED'
  ).length;
  const totalAccepted = rfqs.filter((r) => r.status === 'ACCEPTED').length;
  const totalExpired = rfqs.filter((r) => r.status === 'EXPIRED').length;
  const totalCancelled = rfqs.filter((r) => r.status === 'CANCELLED').length;

  // Calculate rates
  const responseRate = totalPublished > 0
    ? (rfqs.filter((r) => r.quoteCount > 0).length / totalPublished) * 100
    : 0;
  const fillRate = totalPublished > 0
    ? (totalAccepted / totalPublished) * 100
    : 0;
  const expiryRate = totalPublished > 0
    ? (totalExpired / totalPublished) * 100
    : 0;

  // Calculate average response time (time from publish to first quote)
  let totalResponseTimeHours = 0;
  let responseTimeCount = 0;

  for (const rfq of rfqs) {
    const publishedAt = rfq.auditLogs[0]?.createdAt;
    const firstQuote = rfq.quotes[0];

    if (publishedAt && firstQuote) {
      const responseTimeMs = firstQuote.createdAt.getTime() - publishedAt.getTime();
      const responseTimeHours = responseTimeMs / (1000 * 60 * 60);
      totalResponseTimeHours += responseTimeHours;
      responseTimeCount++;
    }
  }

  const avgResponseTimeHours = responseTimeCount > 0
    ? Math.round(totalResponseTimeHours / responseTimeCount)
    : null;

  // Calculate average quotes per RFQ
  const totalQuotes = rfqs.reduce((sum, r) => sum + r.quoteCount, 0);
  const avgQuotesPerRfq = totalCreated > 0
    ? totalQuotes / totalCreated
    : 0;

  // Build funnel
  const funnel: RfqFunnelStage[] = [
    { stage: 'Created', count: totalCreated, percentage: 100 },
    { stage: 'Published', count: totalPublished, percentage: totalCreated > 0 ? (totalPublished / totalCreated) * 100 : 0 },
    { stage: 'Quoted', count: totalQuoted, percentage: totalCreated > 0 ? (totalQuoted / totalCreated) * 100 : 0 },
    { stage: 'Accepted', count: totalAccepted, percentage: totalCreated > 0 ? (totalAccepted / totalCreated) * 100 : 0 },
    { stage: 'Expired', count: totalExpired, percentage: totalCreated > 0 ? (totalExpired / totalCreated) * 100 : 0 },
    { stage: 'Cancelled', count: totalCancelled, percentage: totalCreated > 0 ? (totalCancelled / totalCreated) * 100 : 0 },
  ];

  // Build time series (group by date)
  const timeSeriesMap = new Map<string, RfqTimeBucket>();

  for (const rfq of rfqs) {
    const date = rfq.createdAt.toISOString().split('T')[0];
    const bucket = timeSeriesMap.get(date) || {
      date,
      created: 0,
      quoted: 0,
      accepted: 0,
      expired: 0,
    };

    bucket.created++;
    if (rfq.quoteCount > 0) bucket.quoted++;
    if (rfq.status === 'ACCEPTED') bucket.accepted++;
    if (rfq.status === 'EXPIRED') bucket.expired++;

    timeSeriesMap.set(date, bucket);
  }

  const timeSeries = Array.from(timeSeriesMap.values()).sort(
    (a, b) => a.date.localeCompare(b.date)
  );

  // Calculate supplier metrics
  const supplierMap = new Map<string, SupplierResponseMetrics>();

  for (const rfq of rfqs) {
    for (const quote of rfq.quotes) {
      const existing = supplierMap.get(quote.supplierId);

      if (existing) {
        existing.totalQuotes++;
        if (quote.status === 'ACCEPTED') {
          existing.acceptedQuotes++;
        }
      } else {
        supplierMap.set(quote.supplierId, {
          supplierId: quote.supplierId,
          supplierName: quote.supplier.name,
          totalQuotes: 1,
          acceptedQuotes: quote.status === 'ACCEPTED' ? 1 : 0,
          avgResponseTimeHours: null,
          winRate: 0,
        });
      }
    }
  }

  // Calculate win rate and sort by total quotes
  const topSuppliers = Array.from(supplierMap.values())
    .map((s) => ({
      ...s,
      winRate: s.totalQuotes > 0 ? (s.acceptedQuotes / s.totalQuotes) * 100 : 0,
    }))
    .sort((a, b) => b.totalQuotes - a.totalQuotes)
    .slice(0, 10);

  return {
    summary: {
      totalCreated,
      totalPublished,
      totalQuoted,
      totalAccepted,
      totalExpired,
      totalCancelled,
      responseRate: Math.round(responseRate * 100) / 100,
      fillRate: Math.round(fillRate * 100) / 100,
      expiryRate: Math.round(expiryRate * 100) / 100,
      avgResponseTimeHours,
      avgQuotesPerRfq: Math.round(avgQuotesPerRfq * 100) / 100,
    },
    funnel,
    timeSeries,
    topSuppliers,
  };
}

/**
 * Get quick stats for the admin dashboard (last 30 days)
 */
export async function getRfqQuickStats(): Promise<{
  activeRfqs: number;
  quotesToday: number;
  responseRate: number;
  avgQuotesPerRfq: number;
}> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [activeRfqs, quotesToday, recentStats] = await Promise.all([
    prisma.rfqRequest.count({
      where: {
        status: { in: ['OPEN', 'NEGOTIATING', 'QUOTED'] },
      },
    }),
    prisma.rfqQuote.count({
      where: {
        createdAt: { gte: today },
        status: { not: 'WITHDRAWN' },
      },
    }),
    prisma.rfqRequest.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
        status: { notIn: ['DRAFT', 'PENDING_REVIEW'] },
      },
      select: {
        quoteCount: true,
      },
    }),
  ]);

  const totalQuoted = recentStats.filter((r) => r.quoteCount > 0).length;
  const responseRate = recentStats.length > 0
    ? (totalQuoted / recentStats.length) * 100
    : 0;

  const totalQuotes = recentStats.reduce((sum, r) => sum + r.quoteCount, 0);
  const avgQuotesPerRfq = recentStats.length > 0
    ? totalQuotes / recentStats.length
    : 0;

  return {
    activeRfqs,
    quotesToday,
    responseRate: Math.round(responseRate * 10) / 10,
    avgQuotesPerRfq: Math.round(avgQuotesPerRfq * 10) / 10,
  };
}
