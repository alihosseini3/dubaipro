/**
 * GET /api/admin/media/report
 *
 * Comprehensive enterprise media architecture report.
 * Aggregates data from analytics + audit + cleanup-preview into a single
 * structured JSON response suitable for exporting or displaying in the admin.
 *
 * Sections:
 *   architecture   — schema version, storage backend, provider config
 *   performance    — score dist, compression, Lighthouse targets
 *   seo            — coverage, missing fields, top offenders
 *   queue          — job stats, failure rate, avg duration
 *   debt           — remaining legacy items, risks, recommended actions
 */

import { NextResponse } from 'next/server';

import { handlePrismaError } from '@/lib/api/errors';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import { isAiVisionEnabledSync } from '@/lib/media/ai-vision';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SCHEMA_VERSION = 'media-p7';
const LIGHTHOUSE_TARGETS = {
  LCP_MS:        2000,
  CLS:           0.05,
  TBT_MS:        150,
  AVIF_COVERAGE: 80,
  WEBP_COVERAGE: 90,
  ALT_COVERAGE:  95,
  AVG_SCORE:     75,
};

export async function GET(_req: Request) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const [
      totalAssets,
      sizeAgg,
      compressionAgg,
      withWebP,
      withAvif,
      withAlt,
      withKeywords,
      scoreAgg,
      scoreDistrib,
      queueStats,
      orphanCount,
      duplicateGroups,
      failedJobs,
      storageBreakdown,
    ] = await Promise.all([
      prisma.mediaAsset.count(),
      prisma.mediaAsset.aggregate({ _sum: { size: true } }),
      prisma.mediaAsset.aggregate({ _avg: { compressionRatio: true }, where: { compressionRatio: { not: null, gt: 0 } } }),
      prisma.mediaAsset.count({ where: { variants: { some: { format: 'webp' } } } }),
      prisma.mediaAsset.count({ where: { variants: { some: { format: 'avif' } } } }),
      prisma.mediaAsset.count({ where: { alt: { not: null }, NOT: { alt: '' } } }),
      prisma.mediaAsset.count({ where: { NOT: { keywords: { isEmpty: true } } } }),
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
      ]),
      prisma.mediaTransformJob.groupBy({ by: ['status'], _count: { status: true } }),
      prisma.mediaAsset.count({ where: { usages: { none: {} }, folder: 'general', createdAt: { lt: new Date(Date.now() - 86_400_000) } } }),
      prisma.mediaAsset.groupBy({ by: ['hash'], where: { hash: { not: null } }, having: { hash: { _count: { gt: 1 } } }, _count: { hash: true }, orderBy: { _count: { hash: 'desc' } } }),
      prisma.mediaTransformJob.count({ where: { status: 'failed' } }),
      prisma.mediaAsset.groupBy({ by: ['storageProvider'], _count: { storageProvider: true } }),
    ]);

    const totalSize = Number(sizeAgg._sum.size ?? 0);
    const avgComp = compressionAgg._avg.compressionRatio ?? 0;
    const estOriginalSize = avgComp > 0 ? totalSize / avgComp : totalSize;
    const webpPct = pct(withWebP, totalAssets);
    const avifPct = pct(withAvif, totalAssets);
    const altPct  = pct(withAlt,  totalAssets);
    const avgScore = Math.round(scoreAgg._avg.optimizationScore ?? 0);
    const qMap = Object.fromEntries(queueStats.map((r) => [r.status, r._count.status]));
    const totalJobs = Object.values(qMap).reduce((s, c) => s + c, 0);
    const failRate = totalJobs > 0 ? Math.round((qMap['failed'] ?? 0) / totalJobs * 100) : 0;

    const gaps: string[] = [];
    if (avifPct  < LIGHTHOUSE_TARGETS.AVIF_COVERAGE) gaps.push(`AVIF coverage ${avifPct}% (target ≥${LIGHTHOUSE_TARGETS.AVIF_COVERAGE}%)`);
    if (webpPct  < LIGHTHOUSE_TARGETS.WEBP_COVERAGE) gaps.push(`WebP coverage ${webpPct}% (target ≥${LIGHTHOUSE_TARGETS.WEBP_COVERAGE}%)`);
    if (altPct   < LIGHTHOUSE_TARGETS.ALT_COVERAGE)  gaps.push(`ALT coverage ${altPct}% (target ≥${LIGHTHOUSE_TARGETS.ALT_COVERAGE}%)`);
    if (avgScore < LIGHTHOUSE_TARGETS.AVG_SCORE)     gaps.push(`Avg SEO score ${avgScore}/100 (target ≥${LIGHTHOUSE_TARGETS.AVG_SCORE})`);
    if (orphanCount > 0)                             gaps.push(`${orphanCount} orphan assets (run cleanup)`);
    if (duplicateGroups.length > 0)                  gaps.push(`${duplicateGroups.length} duplicate groups (run dedup)`);
    if (failedJobs > 0)                              gaps.push(`${failedJobs} failed transform jobs`);

    return NextResponse.json({
      generatedAt:   new Date().toISOString(),
      schemaVersion: SCHEMA_VERSION,
      architecture: {
        storageBackend:    process.env.MEDIA_STORAGE ?? 'local',
        cdnEnabled:        !!(process.env.MEDIA_CDN_URL ?? process.env.MEDIA_S3_PUBLIC_URL),
        aiVisionEnabled:   isAiVisionEnabledSync(),
        aiProvider:        process.env.MEDIA_AI_PROVIDER ?? null,
        workerCronEnabled: true,  // vercel.json cron
        rateLimitEnabled:  true,
        storageProviders:  storageBreakdown.map((r) => ({ provider: r.storageProvider, count: r._count.storageProvider })),
      },
      performance: {
        totalAssets,
        totalSizeBytes:         totalSize,
        estimatedOriginalBytes: estOriginalSize,
        bytesSaved:             estOriginalSize - totalSize,
        bytesSavedPct:          estOriginalSize > 0 ? Math.round((estOriginalSize - totalSize) / estOriginalSize * 100) : 0,
        avgCompressionRatio:    Math.round(avgComp * 100) / 100,
        scoreDistribution: { excellent: scoreDistrib[0], good: scoreDistrib[1], poor: scoreDistrib[2], critical: scoreDistrib[3] },
        avgScore,
        lighthouseTargets:      LIGHTHOUSE_TARGETS,
        currentVsTarget: {
          AVIF:  { current: avifPct,  target: LIGHTHOUSE_TARGETS.AVIF_COVERAGE,  pass: avifPct  >= LIGHTHOUSE_TARGETS.AVIF_COVERAGE },
          WebP:  { current: webpPct,  target: LIGHTHOUSE_TARGETS.WEBP_COVERAGE,  pass: webpPct  >= LIGHTHOUSE_TARGETS.WEBP_COVERAGE },
          ALT:   { current: altPct,   target: LIGHTHOUSE_TARGETS.ALT_COVERAGE,   pass: altPct   >= LIGHTHOUSE_TARGETS.ALT_COVERAGE },
          Score: { current: avgScore, target: LIGHTHOUSE_TARGETS.AVG_SCORE,      pass: avgScore >= LIGHTHOUSE_TARGETS.AVG_SCORE },
        },
      },
      seo: {
        altCoverage:      altPct,
        keywordCoverage:  pct(withKeywords, totalAssets),
        webpCoverage:     webpPct,
        avifCoverage:     avifPct,
        avgOptScore:      avgScore,
        orphanAssets:     orphanCount,
        duplicateGroups:  duplicateGroups.length,
      },
      queue: {
        byStatus:        qMap,
        total:           totalJobs,
        failureRatePct:  failRate,
        health:          failRate < 5 ? 'healthy' : failRate < 20 ? 'degraded' : 'critical',
      },
      debt: {
        gaps,
        risksCount:   gaps.length,
        status:       gaps.length === 0 ? 'clean' : gaps.length <= 2 ? 'minor' : gaps.length <= 5 ? 'moderate' : 'critical',
        recommendations: [
          ...(avifPct  < LIGHTHOUSE_TARGETS.AVIF_COVERAGE ? ['Run bulk "regenerate" on all assets to produce AVIF variants'] : []),
          ...(altPct   < LIGHTHOUSE_TARGETS.ALT_COVERAGE  ? ['Use ALT auto-suggest (✨) on assets missing alt text'] : []),
          ...(orphanCount > 10 ? ['Run /api/admin/media/cleanup to archive orphan assets'] : []),
          ...(failedJobs > 0  ? ['Inspect failed transform jobs via GET /api/media/worker'] : []),
          ...(!isAiVisionEnabledSync() ? ['Configure AI Vision in the admin panel (/admin/gallery → 🛠 Tools)'] : []),
        ],
      },
    });
  } catch (error) {
    return handlePrismaError(error, 'GET /api/admin/media/report');
  }
}

function pct(n: number, total: number) {
  return total ? Math.round(n / total * 100) : 0;
}
