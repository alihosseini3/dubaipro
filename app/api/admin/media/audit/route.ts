/**
 * GET /api/admin/media/audit
 *
 * Full media architecture audit.
 * Scans the DB (not the FS) and returns a structured JSON report covering:
 *   - total assets, variants, transform jobs
 *   - SEO health (missing alt, keywords, WebP/AVIF coverage)
 *   - Storage distribution by provider
 *   - Processing status distribution
 *   - Unused assets, duplicates
 *   - Score distribution buckets
 *   - Folder distribution
 *   - Top 10 oversized assets
 *   - Top 10 unoptimized assets (lowest score)
 *   - Assets with failed jobs
 */

import { NextResponse } from 'next/server';

import { handlePrismaError } from '@/lib/api/errors';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OVERSIZE = 200 * 1024;  // 200 KB

export async function GET(_req: Request) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const [
      totalAssets,
      totalVariants,
      totalJobs,
      missingAlt,
      missingKeywords,
      noWebP,
      noAvif,
      oversized,
      noResponsive,
      unused,
      failedJobs,
      pendingJobs,
      lowScore,
      noScore,
      scoreAgg,
      storageBreakdown,
      statusBreakdown,
      folderBreakdown,
      mimeBreakdown,
      dupRows,
      topOversized,
      topLowScore,
    ] = await Promise.all([
      /* counts */
      prisma.mediaAsset.count(),
      prisma.mediaVariant.count(),
      prisma.mediaTransformJob.count(),
      prisma.mediaAsset.count({ where: { OR: [{ alt: null }, { alt: '' }] } }),
      prisma.mediaAsset.count({ where: { keywords: { isEmpty: true } } }),
      prisma.mediaAsset.count({ where: { variants: { none: { format: 'webp' } } } }),
      prisma.mediaAsset.count({ where: { variants: { none: { format: 'avif' } } } }),
      prisma.mediaAsset.count({ where: { size: { gt: OVERSIZE } } }),
      prisma.mediaAsset.count({ where: { NOT: { variants: { some: {} } } } }),
      prisma.mediaAsset.count({ where: { usages: { none: {} } } }),
      prisma.mediaTransformJob.count({ where: { status: 'failed' } }),
      prisma.mediaTransformJob.count({ where: { status: 'pending' } }),
      prisma.mediaAsset.count({ where: { optimizationScore: { lt: 60 } } }),
      prisma.mediaAsset.count({ where: { optimizationScore: null } }),
      prisma.mediaAsset.aggregate({ _avg: { optimizationScore: true }, _min: { optimizationScore: true }, _max: { optimizationScore: true } }),
      /* breakdowns */
      prisma.mediaAsset.groupBy({ by: ['storageProvider'], _count: { storageProvider: true } }),
      prisma.mediaAsset.groupBy({ by: ['processingStatus'], _count: { processingStatus: true } }),
      prisma.mediaAsset.groupBy({ by: ['folder'], _count: { folder: true }, orderBy: { _count: { folder: 'desc' } }, take: 20 }),
      prisma.mediaAsset.groupBy({ by: ['mimeType'], _count: { mimeType: true }, orderBy: { _count: { mimeType: 'desc' } } }),
      /* duplicates */
      prisma.mediaAsset.groupBy({
        by: ['hash'],
        where: { hash: { not: null } },
        having: { hash: { _count: { gt: 1 } } },
        _count: { hash: true },
      }),
      /* top offenders */
      prisma.mediaAsset.findMany({
        where:   { size: { gt: OVERSIZE } },
        orderBy: { size: 'desc' },
        take:    10,
        select:  { id: true, originalName: true, size: true, mimeType: true, folder: true, url: true },
      }),
      prisma.mediaAsset.findMany({
        where:   { optimizationScore: { not: null, lt: 40 } },
        orderBy: { optimizationScore: 'asc' },
        take:    10,
        select:  { id: true, originalName: true, optimizationScore: true, folder: true, url: true },
      }),
    ]);

    /* Score distribution buckets */
    const [score0_39, score40_59, score60_79, score80_100] = await Promise.all([
      prisma.mediaAsset.count({ where: { optimizationScore: { gte: 0,  lt: 40 } } }),
      prisma.mediaAsset.count({ where: { optimizationScore: { gte: 40, lt: 60 } } }),
      prisma.mediaAsset.count({ where: { optimizationScore: { gte: 60, lt: 80 } } }),
      prisma.mediaAsset.count({ where: { optimizationScore: { gte: 80        } } }),
    ]);

    const report = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalAssets,
        totalVariants,
        totalTransformJobs: totalJobs,
        duplicateGroups:    dupRows.length,
        duplicateAssets:    dupRows.reduce((s, r) => s + r._count.hash, 0),
      },
      seoHealth: {
        missingAlt,
        missingAltPct:         pct(missingAlt, totalAssets),
        missingKeywords,
        missingKeywordsPct:    pct(missingKeywords, totalAssets),
        noWebP,
        noWebPPct:             pct(noWebP, totalAssets),
        noAvif,
        noAvifPct:             pct(noAvif, totalAssets),
        oversized,
        oversizedPct:          pct(oversized, totalAssets),
        noResponsive,
        noResponsivePct:       pct(noResponsive, totalAssets),
        unused,
        unusedPct:             pct(unused, totalAssets),
        lowScore,
        noScore,
        scoreAvg:              Math.round(scoreAgg._avg.optimizationScore ?? 0),
        scoreMin:              scoreAgg._min.optimizationScore ?? 0,
        scoreMax:              scoreAgg._max.optimizationScore ?? 0,
        scoreDistribution: {
          critical:   score0_39,   // 0-39
          poor:       score40_59,  // 40-59
          good:       score60_79,  // 60-79
          excellent:  score80_100, // 80-100
          unscored:   noScore,
        },
      },
      queue: {
        pending:       pendingJobs,
        failed:        failedJobs,
        recommendations: [
          ...(noWebP > 0  ? [`${noWebP} assets missing WebP — run bulk regenerate`] : []),
          ...(noAvif > 0  ? [`${noAvif} assets missing AVIF — run bulk regenerate`] : []),
          ...(oversized > 0 ? [`${oversized} assets over 200 KB — run bulk optimize`] : []),
          ...(failedJobs > 0 ? [`${failedJobs} failed transform jobs — check /api/media/worker`] : []),
          ...(pendingJobs > 0 ? [`${pendingJobs} pending transform jobs — trigger /api/media/worker`] : []),
        ],
      },
      storage: storageBreakdown.map((r) => ({
        provider: r.storageProvider,
        count:    r._count.storageProvider,
        pct:      pct(r._count.storageProvider, totalAssets),
      })),
      processingStatus: statusBreakdown.map((r) => ({
        status: r.processingStatus,
        count:  r._count.processingStatus,
      })),
      folders: folderBreakdown.map((r) => ({
        folder: r.folder,
        count:  r._count.folder,
      })),
      mimeTypes: mimeBreakdown.map((r) => ({
        mimeType: r.mimeType,
        count:    r._count.mimeType,
      })),
      topOversizedAssets: topOversized,
      topUnoptimizedAssets: topLowScore,
    };

    return NextResponse.json(report);
  } catch (error) {
    return handlePrismaError(error, 'GET /api/admin/media/audit');
  }
}

function pct(n: number, total: number) {
  if (!total) return 0;
  return Math.round((n / total) * 100);
}
