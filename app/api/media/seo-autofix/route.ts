/**
 * POST /api/media/seo-autofix
 *
 * Bulk-fix SEO issues for media assets:
 *   1. AI Vision auto-fills missing alt / title / caption / keywords
 *   2. Schedules `regenerate` jobs for images missing WebP/AVIF variants
 *
 * Body: { folder?: string; limit?: number; scope?: 'meta' | 'variants' | 'all' }
 *
 * Processes a small batch per call (default 12) so the client can drive a
 * progress loop without hitting serverless timeouts. Returns `remaining` so
 * the client knows when to stop.
 *
 * Response: {
 *   processed:         number;   // assets attempted for AI meta
 *   aiSuccess:         number;
 *   aiFailed:          number;
 *   aiErrors:          string[]; // distinct error messages (for debugging)
 *   variantsScheduled: number;   // regenerate jobs enqueued this call
 *   remaining:         number;   // assets still needing AI meta after this batch
 *   aiConfigured:      boolean;
 * }
 */

import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { getAdminOrNull } from '@/lib/auth/require-admin';
import { generateImageMeta, isAiVisionEnabled } from '@/lib/media/ai-vision';
import { readImageBuffer } from '@/lib/media/read-image';
import { computeMediaScore } from '@/lib/media/score';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface Body {
  folder?: unknown;
  limit?:  unknown;
  scope?:  unknown;
}

async function pMap<T, R>(items: T[], fn: (item: T) => Promise<R>, concurrency = 3): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length || 1) }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function POST(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Body;
  const folder = typeof body.folder === 'string' && body.folder !== 'all' && body.folder.trim()
    ? body.folder.trim()
    : undefined;
  const limit  = Math.min(Math.max(typeof body.limit === 'number' ? body.limit : 12, 1), 25);
  const scope  = body.scope === 'meta' || body.scope === 'variants' ? body.scope : 'all';

  const aiConfigured = await isAiVisionEnabled();

  const result = {
    processed:         0,
    aiSuccess:         0,
    aiFailed:          0,
    aiErrors:          [] as string[],
    variantsScheduled: 0,
    rescored:          0,
    remaining:         0,
    aiConfigured,
  };

  /* ─── Part 1: AI meta autofix (alt / title / caption / keywords) ─── */
  if ((scope === 'meta' || scope === 'all') && aiConfigured) {
    const metaWhere: Prisma.MediaAssetWhereInput = {
      mimeType: { startsWith: 'image/' },
      OR: [
        { alt: null },
        { alt: '' },
        { keywords: { isEmpty: true } },
      ],
      ...(folder ? { folder } : {}),
    };

    const totalMissing = await prisma.mediaAsset.count({ where: metaWhere });

    const targets = await prisma.mediaAsset.findMany({
      where:  metaWhere,
      select: {
        id: true, url: true, mimeType: true, originalName: true,
        context: true, folder: true,
        alt: true, title: true, caption: true,
        keywords: true, tags: true,
      },
      take:    limit,
      orderBy: { createdAt: 'desc' },
    });

    const aiResults = await pMap(targets, async (asset) => {
      try {
        const buffer = await readImageBuffer(asset.url);
        if (!buffer) return { ok: false as const, error: 'cannot read image file' };

        /* Best-effort product context */
        let productName:  string | null = null;
        let categoryName: string | null = null;
        let brandName:    string | null = null;
        try {
          const usage = await prisma.mediaUsage.findFirst({
            where:  { assetId: asset.id, entityType: 'product' },
            select: { entityId: true },
          });
          if (usage?.entityId) {
            const product = await prisma.product.findUnique({
              where:  { id: usage.entityId },
              select: {
                title:    true,
                category: { select: { name: true } },
                brand:    { select: { name: true } },
              },
            });
            if (product) {
              productName  = product.title;
              categoryName = product.category?.name ?? null;
              brandName    = product.brand?.name    ?? null;
            }
          }
        } catch { /* non-fatal */ }

        const ai = await generateImageMeta(
          { buffer, mimeType: asset.mimeType },
          { context: asset.context, folder: asset.folder, filename: asset.originalName, productName, categoryName, brandName },
        );
        if (!ai) return { ok: false as const, error: 'AI returned no result' };

        const patch: Prisma.MediaAssetUpdateInput = {};
        if (!asset.alt     && ai.alt)     patch.alt     = ai.alt;
        if (!asset.title   && ai.title)   patch.title   = ai.title;
        if (!asset.caption && ai.caption) patch.caption = ai.caption;
        if ((!asset.keywords || asset.keywords.length === 0) && ai.keywords?.length) {
          patch.keywords = ai.keywords.slice(0, 12);
        }

        if (Object.keys(patch).length > 0) {
          await prisma.mediaAsset.update({ where: { id: asset.id }, data: patch });
        }
        return { ok: true as const };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false as const, error: msg.slice(0, 200) };
      }
    }, 3);

    for (const r of aiResults) {
      result.processed += 1;
      if (r.ok) {
        result.aiSuccess += 1;
      } else {
        result.aiFailed += 1;
        if (r.error && !result.aiErrors.includes(r.error)) {
          result.aiErrors.push(r.error);
        }
      }
    }
    result.remaining = Math.max(0, totalMissing - targets.length);
  }

  /* ─── Part 2: schedule variant regeneration (WebP/AVIF) ─── */
  if (scope === 'variants' || scope === 'all') {
    const variantWhere: Prisma.MediaAssetWhereInput = {
      mimeType: { startsWith: 'image/' },
      ...(folder ? { folder } : {}),
      OR: [
        { variants: { none: { format: 'webp' } } },
        { variants: { none: { format: 'avif' } } },
      ],
    };

    const targets = await prisma.mediaAsset.findMany({
      where:  variantWhere,
      select: { id: true },
      take:   100,
    });

    for (const t of targets) {
      try {
        await prisma.mediaTransformJob.upsert({
          where:  { id: `${t.id}-regenerate` },
          create: { id: `${t.id}-regenerate`, assetId: t.id, action: 'regenerate', priority: 5 },
          update: { status: 'pending', startedAt: null, doneAt: null, error: null, attempts: 0 },
        });
        result.variantsScheduled += 1;
      } catch {
        /* best-effort */
      }
    }
  }

  /* ─── Part 3: re-score existing assets with updated formula ────────── */
  /* Run on every call so newly-generated variants are immediately reflected */
  {
    const rescoreWhere: Prisma.MediaAssetWhereInput = {
      mimeType: { startsWith: 'image/' },
      ...(folder ? { folder } : {}),
    };
    const assets = await prisma.mediaAsset.findMany({
      where:  rescoreWhere,
      select: {
        id: true, alt: true, keywords: true, mimeType: true,
        size: true, width: true, height: true,
        variants: { select: { format: true } },
      },
      take: 200,
    });
    for (const a of assets) {
      const hasWebpVariant = a.variants.some(
        (v) => v.format === 'webp' || v.format === 'avif',
      );
      const score = computeMediaScore({
        alt: a.alt, keywords: a.keywords, mimeType: a.mimeType,
        size: a.size, width: a.width, height: a.height,
        variantCount: a.variants.length, hasWebpVariant,
      });
      await prisma.mediaAsset.update({
        where: { id: a.id },
        data:  { optimizationScore: score.total },
      });
      result.rescored += 1;
    }
  }

  return NextResponse.json(result);
}
