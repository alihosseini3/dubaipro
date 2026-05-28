/**
 * GET /api/admin/media/analytics
 *
 * Full media system analytics.
 * Returns metrics suitable for the MediaAnalyticsDashboard component.
 *
 * Computes:
 *   - Storage totals and savings
 *   - AVIF / WebP coverage
 *   - SEO completion rates
 *   - Transform queue health
 *   - Score distribution
 *   - Bandwidth savings estimate
 *   - Daily upload trends (last 30 days)
 *   - Top heavy assets
 */

import { NextResponse } from 'next/server';

import { handlePrismaError } from '@/lib/api/errors';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60_000);

    const [
      totalAssets,
      totalVariants,
      /* Storage */
      sizeAgg,
      compressionAgg,
      /* Format coverage */
      withWebP,
      withAvif,
      withOriginalUrl,
      /* SEO */
      withAlt,
      withKeywords,
      withSeoTitle,
      /* Queue */
      queueByStatus,
      queueByAction,
      failedJobs,
      /* Scores */
      scoreAgg,
      scoreDistrib,
      /* Recent uploads (last 30 days) */
      recentUploads,
      /* Top heavy */
      topHeavy,
      /* MIME breakdown */
      mimeBreakdown,
    ] = await Promise.all([
      prisma.mediaAsset.count(),
      prisma.mediaVariant.count(),

      /* Storage: sum of all asset sizes in bytes */
      prisma.mediaAsset.aggregate({ _sum: { size: true } }),

      /* Avg compression ratio for assets that have it */
      prisma.mediaAsset.aggregate({
        _avg: { compressionRatio: true },
        where: { compressionRatio: { not: null, gt: 0 } },
      }),

      /* Coverage */
      prisma.mediaAsset.count({ where: { variants: { some: { format: 'webp' } } } }),
      prisma.mediaAsset.count({ where: { variants: { some: { format: 'avif' } } } }),
      prisma.mediaAsset.count({ where: { originalUrl: { not: null } } }),

      /* SEO */
      prisma.mediaAsset.count({ where: { alt: { not: null }, NOT: { alt: '' } } }),
      prisma.mediaAsset.count({ where: { NOT: { keywords: { isEmpty: true } } } }),
      prisma.mediaAsset.count({ where: { seoTitle: { not: null }, NOT: { seoTitle: '' } } }),

      /* Queue */
      prisma.mediaTransformJob.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      prisma.mediaTransformJob.groupBy({
        by: ['action'],
        _count: { action: true },
        orderBy: { _count: { action: 'desc' } },
      }),
      prisma.mediaTransformJob.findMany({
        where:   { status: 'failed' },
        orderBy: { doneAt: 'desc' },
        take:    5,
        select:  { id: true, assetId: true, action: true, error: true, attempts: true, doneAt: true },
      }),

      /* Scores */
      prisma.mediaAsset.aggregate({
        _avg: { optimizationScore: true },
        _min: { optimizationScore: true },
        _max: { optimizationScore: true },
        where: { optimizationScore: { not: null } },
      }),
      Promise.all([
        prisma.mediaAsset.count({ where: { optimizationScore: { gte: 80 } } }),
        prisma.mediaAsset.count({ where: { optimizationScore: { gte: 60, lt: 80 } } }),
        prisma.mediaAsset.count({ where: { optimizationScore: { gte: 40, lt: 60 } } }),
        prisma.mediaAsset.count({ where: { optimizationScore: { lt: 40 } } }),
        prisma.mediaAsset.count({ where: { optimizationScore: null } }),
      ]),

      /* Daily uploads for last 30 days — grouped by date */
      prisma.$queryRaw<{ day: string; count: bigint }[]>`
        SELECT DATE_TRUNC('day', "createdAt")::date AS day,
               COUNT(*) AS count
        FROM "MediaAsset"
        WHERE "createdAt" >= ${thirtyDaysAgo}
        GROUP BY 1
        ORDER BY 1 ASC
      `,

      /* Top 5 heaviest */
      prisma.mediaAsset.findMany({
        orderBy: { size: 'desc' },
        take:    10,
        select:  { id: true, originalName: true, size: true, mimeType: true, folder: true,
                   optimizationScore: true, url: true, thumbnailUrl: true },
      }),

      /* MIME types */
      prisma.mediaAsset.groupBy({
        by:      ['mimeType'],
        _count:  { mimeType: true },
        orderBy: { _count: { mimeType: 'desc' } },
      }),
    ]);

    const totalSize = Number(sizeAgg._sum.size ?? 0);
    const avgCompression = compressionAgg._avg.compressionRatio ?? 0;

    /* Estimated bandwidth savings:
     * If avg compressionRatio = 0.4, the original was ~2.5× the stored size.
     * Bytes saved = totalSize * (1 / avgCompression - 1) */
    const estimatedOriginalSize = avgCompression > 0
      ? Math.round(totalSize / avgCompression)
      : totalSize;
    const bytesSaved = estimatedOriginalSize - totalSize;

    /* SEO completion score: weighted average */
    const seoScore = totalAssets
      ? Math.round(
          (withAlt / totalAssets * 0.5 +
           withKeywords / totalAssets * 0.3 +
           withSeoTitle / totalAssets * 0.2) * 100
        )
      : 0;

    const queueStatusMap = Object.fromEntries(
      queueByStatus.map((r) => [r.status, r._count.status])
    );

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      overview: {
        totalAssets,
        totalVariants,
        totalSizeBytes:          totalSize,
        estimatedOriginalBytes:  estimatedOriginalSize,
        bytesSaved,
        bytesSavedPct:           estimatedOriginalSize > 0
          ? Math.round(bytesSaved / estimatedOriginalSize * 100) : 0,
        avgCompressionRatio:     Math.round(avgCompression * 100) / 100,
        withOriginalUrl,
      },
      coverage: {
        webp:      { count: withWebP,     pct: pct(withWebP, totalAssets) },
        avif:      { count: withAvif,     pct: pct(withAvif, totalAssets) },
        alt:       { count: withAlt,      pct: pct(withAlt, totalAssets) },
        keywords:  { count: withKeywords, pct: pct(withKeywords, totalAssets) },
        seoTitle:  { count: withSeoTitle, pct: pct(withSeoTitle, totalAssets) },
        seoScore,
      },
      scoreDistribution: {
        excellent: scoreDistrib[0],   // 80-100
        good:      scoreDistrib[1],   // 60-79
        poor:      scoreDistrib[2],   // 40-59
        critical:  scoreDistrib[3],   // 0-39
        unscored:  scoreDistrib[4],
        avg:       Math.round(scoreAgg._avg.optimizationScore ?? 0),
        min:       scoreAgg._min.optimizationScore ?? 0,
        max:       scoreAgg._max.optimizationScore ?? 0,
      },
      queue: {
        byStatus:   queueStatusMap,
        byAction:   queueByAction.map((r) => ({ action: r.action, count: r._count.action })),
        recentFailed: failedJobs,
      },
      trends: {
        dailyUploads: recentUploads.map((r) => ({
          day:   String(r.day),
          count: Number(r.count),
        })),
      },
      topHeavyAssets: topHeavy,
      mimeTypes: mimeBreakdown.map((r) => ({ mimeType: r.mimeType, count: r._count.mimeType })),
    });
  } catch (error) {
    return handlePrismaError(error, 'GET /api/admin/media/analytics');
  }
}

function pct(n: number, total: number) {
  return total ? Math.round(n / total * 100) : 0;
}
