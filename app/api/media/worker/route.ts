/**
 * GET  /api/media/worker  — peek at queue depth (monitoring / health check)
 * POST /api/media/worker  — claim + process one pending MediaTransformJob
 *
 * Designed to be called by:
 *   - Vercel Cron  (every 1 min):  POST with no body
 *   - Manual admin trigger:        POST { ids: string[] } to force-run specific jobs
 *
 * Security: requires a shared MEDIA_WORKER_SECRET header OR admin session.
 *
 * Actions supported:
 *   optimize   — re-encode master variants at the preset quality, update DB
 *   regenerate — re-run full pipeline from stored originalUrl
 */

import { NextResponse } from 'next/server';
import sharp from 'sharp';

import { handlePrismaError } from '@/lib/api/errors';
import { emitMediaEvent, startTimer } from '@/lib/observability/media-events';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import { encodeVariant, buildVariantFilename, buildVariantUrl, toRenderedVariant } from '@/lib/media/formats';
import type { BlurResult } from '@/lib/media/blur';
import { computeBlurAndColor, BLUR_FALLBACK } from '@/lib/media/blur';
import { computeMediaScore } from '@/lib/media/score';
import { buildVariantSpecs } from '@/lib/media/variants';
import { storageAdapter } from '@/lib/media/store/index';
import { MEDIA_PUBLIC_DIR } from '@/lib/media/store/fs-store';
import { presetFromContext, getPreset } from '@/lib/media/presets';
import { generateImageMeta, isAiVisionEnabled } from '@/lib/media/ai-vision';
import { readImageBuffer } from '@/lib/media/read-image';
import { prisma } from '@/lib/prisma';
import type { MediaFormat } from '@/lib/media/types';

export const runtime        = 'nodejs';
export const maxDuration    = 60;  // Vercel Pro: up to 300s

const BATCH_SIZE = 4;
const JOB_TIMEOUT_MS = 55_000;  // stay under maxDuration with margin

/* ── auth helper ── */
async function isAuthorized(request: Request): Promise<boolean> {
  const secret = process.env.MEDIA_WORKER_SECRET;
  if (secret) {
    const header = request.headers.get('x-worker-secret');
    if (header === secret) return true;
  }
  const admin = await getAdminOrNull();
  return !!admin;
}

/* ── GET: queue health ── */
export async function GET(request: Request) {
  if (!(await isAuthorized(request)))
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const [pending, processing, failed, total] = await Promise.all([
      prisma.mediaTransformJob.count({ where: { status: 'pending' } }),
      prisma.mediaTransformJob.count({ where: { status: 'processing' } }),
      prisma.mediaTransformJob.count({ where: { status: 'failed' } }),
      prisma.mediaTransformJob.count(),
    ]);
    return NextResponse.json({ pending, processing, failed, total });
  } catch (error) {
    return handlePrismaError(error, 'GET /api/media/worker');
  }
}

/* ── POST: process batch ── */
export async function POST(request: Request) {
  if (!(await isAuthorized(request)))
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    /* Optionally force-run specific jobs */
    let forceIds: string[] | undefined;
    try {
      const body = await request.json() as { ids?: unknown; action?: string };
      if (body.action === 'retry_failed') {
        const res = await prisma.mediaTransformJob.updateMany({
          where: { status: 'failed' },
          data:  { status: 'pending', error: null, attempts: 0 },
        });
        return NextResponse.json({ retried: res.count });
      }
      if (Array.isArray(body.ids)) forceIds = body.ids.filter((x): x is string => typeof x === 'string');
    } catch { /* no body = pick from queue */ }

    /* Claim jobs atomically */
    const claimed: { id: string; assetId: string; action: string; params: unknown }[] = [];
    if (forceIds?.length) {
      await prisma.mediaTransformJob.updateMany({
        where:  { id: { in: forceIds }, status: { notIn: ['processing'] } },
        data:   { status: 'processing', startedAt: new Date(), attempts: { increment: 1 } },
      });
      const rows = await prisma.mediaTransformJob.findMany({
        where:  { id: { in: forceIds }, status: 'processing' },
        select: { id: true, assetId: true, action: true, params: true },
      });
      claimed.push(...rows);
    } else {
      /* Stale processing jobs (>5 min) → revert to pending for retry */
      const stale = new Date(Date.now() - 5 * 60 * 1000);
      await prisma.mediaTransformJob.updateMany({
        where: { status: 'processing', startedAt: { lt: stale }, attempts: { lt: 5 } },
        data:  { status: 'pending', startedAt: null },
      });

      /* Claim BATCH_SIZE pending jobs with lowest priority */
      const pending = await prisma.mediaTransformJob.findMany({
        where:   { status: 'pending', attempts: { lt: 5 } },
        orderBy: [{ priority: 'desc' }, { scheduledAt: 'asc' }],
        take:    BATCH_SIZE,
        select:  { id: true, assetId: true, action: true, params: true },
      });
      if (pending.length === 0) return NextResponse.json({ processed: 0, message: 'Queue empty' });

      await prisma.mediaTransformJob.updateMany({
        where: { id: { in: pending.map((j) => j.id) } },
        data:  { status: 'processing', startedAt: new Date(), attempts: { increment: 1 } },
      });
      claimed.push(...pending);
    }

    if (claimed.length === 0) return NextResponse.json({ processed: 0 });

    /* Process each job — individually timed */
    const results = await Promise.allSettled(
      claimed.map(async (job) => {
        const elapsed = startTimer();
        try {
          await processJob(job);
          emitMediaEvent({
            event:    'transform_completed',
            jobId:    job.id,
            assetId:  job.assetId,
            duration: elapsed(),
            meta:     { action: job.action },
          });
        } catch (err) {
          emitMediaEvent({
            event:   'transform_failed',
            jobId:   job.id,
            assetId: job.assetId,
            error:   err instanceof Error ? err.message : String(err),
            meta:    { action: job.action },
          });
          throw err;
        }
      })
    );

    let processed = 0, failedCount = 0;
    await Promise.all(results.map((r, i) => {
      const job = claimed[i]!;
      if (r.status === 'fulfilled') {
        processed++;
        return prisma.mediaTransformJob.update({
          where: { id: job.id },
          data:  { status: 'done', doneAt: new Date(), error: null },
        });
      } else {
        failedCount++;
        const err = r.reason instanceof Error ? r.reason.message : String(r.reason);
        return prisma.mediaTransformJob.update({
          where: { id: job.id },
          data:  { status: 'failed', error: err },
        });
      }
    }));

    return NextResponse.json({ processed, failed: failedCount, total: claimed.length });
  } catch (error) {
    return handlePrismaError(error, 'POST /api/media/worker');
  }
}

/* ── Job dispatcher ── */
async function processJob(job: { id: string; assetId: string; action: string; params: unknown }) {
  const params = (job.params ?? {}) as Record<string, unknown>;

  if (job.action === 'optimize') {
    await runOptimize(job.assetId, params);
  } else if (job.action === 'regenerate') {
    await runRegenerate(job.assetId, params);
  } else if (job.action === 'ai_meta') {
    await runAiMeta(job.assetId, params);
  } else {
    throw new Error(`Unknown action: ${job.action}`);
  }
}

/* ── optimize: re-encode master variants at improved quality ── */
async function runOptimize(assetId: string, params: Record<string, unknown>) {
  const asset = await prisma.mediaAsset.findUnique({
    where:   { id: assetId },
    include: { variants: true },
  });
  if (!asset) throw new Error(`Asset ${assetId} not found`);
  if (!asset.originalUrl) throw new Error(`Asset ${assetId} has no originalUrl — cannot optimize`);

  const preset    = presetFromContext(asset.context);
  const quality   = typeof params.quality === 'number' ? params.quality : preset.quality;
  const skipAvif  = params.skipAvif === true || preset.skipAvif === true;
  const formats: MediaFormat[] = skipAvif ? ['webp'] : ['webp', 'avif'];

  /* Fetch original file */
  const resp   = await fetch(asset.originalUrl);
  if (!resp.ok) throw new Error(`Could not fetch original: ${resp.status}`);
  const buffer = Buffer.from(await resp.arrayBuffer());
  const meta   = await sharp(buffer, { failOn: 'error' }).rotate().metadata();

  const specs = buildVariantSpecs(preset.maxDimension, formats);

  for (const variant of asset.variants) {
    const spec = specs.find((s) => s.preset === variant.preset && s.format === variant.format);
    if (!spec) continue;
    if ((meta.width ?? 0) > 0 && spec.width > (meta.width ?? 0)) continue;

    const effectiveSpec = spec.preset === 'original' ? { ...spec, quality } : spec;
    const encoded = await encodeVariant(buffer, effectiveSpec, { stripMeta: true });

    const filename = variant.url.startsWith(`${MEDIA_PUBLIC_DIR}/`)
      ? variant.url.slice(MEDIA_PUBLIC_DIR.length + 1)
      : variant.url.split('/').pop()!;

    await storageAdapter.put({ filename, buffer: encoded.buffer, mimeType: `image/${variant.format}` });

    if (variant.preset === 'original' && variant.format === 'webp') {
      const score = computeMediaScore({
        alt:          asset.alt,
        keywords:     asset.keywords,
        mimeType:     asset.mimeType,
        size:         encoded.buffer.byteLength,
        width:        encoded.width,
        height:       encoded.height,
        variantCount: asset.variants.length,
      });
      await prisma.mediaAsset.update({
        where: { id: assetId },
        data:  {
          width:             encoded.width,
          height:            encoded.height,
          size:              encoded.buffer.byteLength,
          optimizationScore: score.total,
          compressionRatio:  encoded.buffer.byteLength / (buffer.byteLength || 1),
        },
      });
      await prisma.mediaVariant.update({
        where: { id: variant.id },
        data:  { width: encoded.width, height: encoded.height, size: encoded.buffer.byteLength },
      });
    }
  }
}

/* ── regenerate: re-run full pipeline from originalUrl ── */
async function runRegenerate(assetId: string, params: Record<string, unknown>) {
  const asset = await prisma.mediaAsset.findUnique({
    where:   { id: assetId },
    include: { variants: true },
  });
  if (!asset) throw new Error(`Asset ${assetId} not found`);

  const preset   = presetFromContext(asset.context);
  const quality  = typeof params.quality === 'number' ? params.quality : preset.quality;
  const skipAvif = params.skipAvif === true || preset.skipAvif === true;
  const formats: MediaFormat[] = skipAvif ? ['webp'] : ['webp', 'avif'];

  /* Prefer the stored original; fall back to the master URL */
  const sourceUrl = asset.originalUrl || asset.url;
  if (!sourceUrl) throw new Error(`Asset ${assetId} has no URL — cannot regenerate`);

  const buffer = await readImageBuffer(sourceUrl);
  if (!buffer) throw new Error(`Could not read image for asset ${assetId} from ${sourceUrl}`);
  const meta = await sharp(buffer, { failOn: 'none' }).rotate().metadata();

  const specs    = buildVariantSpecs(preset.maxDimension, formats);
  const baseSlug = asset.filename.replace(/-[a-f0-9]{8}-(thumb|original|sm|md|lg)-[^.]+\.[^.]+$/, '');

  /* Delete old variant files + rows */
  const oldFilenames = asset.variants
    .map((v) => v.url.startsWith(`${MEDIA_PUBLIC_DIR}/`) ? v.url.slice(MEDIA_PUBLIC_DIR.length + 1) : '')
    .filter(Boolean);
  await Promise.allSettled(oldFilenames.map((f) => storageAdapter.delete(f)));
  await prisma.mediaVariant.deleteMany({ where: { assetId } });

  /* Re-encode all specs */
  type VariantCreate = { preset: string; format: string; url: string; width: number; height: number; size: number; assetId: string };
  const newVariants: VariantCreate[] = [];
  let masterWidth = asset.width ?? 0, masterHeight = asset.height ?? 0, masterSize = asset.size;

  for (const spec of specs) {
    if ((meta.width ?? 0) > 0 && spec.width > (meta.width ?? 0) && spec.width > 0) continue;
    const effectiveSpec = spec.preset === 'original' ? { ...spec, quality } : spec;
    const encoded = await encodeVariant(buffer, effectiveSpec, { stripMeta: true });
    const hashShort = asset.hash?.slice(0, 8) ?? 'regen';
    const filename  = buildVariantFilename(baseSlug, hashShort, effectiveSpec.preset, effectiveSpec.format);
    const { url }   = await storageAdapter.put({ filename, buffer: encoded.buffer, mimeType: `image/${effectiveSpec.format}` });
    const rendered  = toRenderedVariant(effectiveSpec, encoded, filename, url);
    newVariants.push({ preset: rendered.preset, format: rendered.format, url: rendered.url, width: rendered.width, height: rendered.height, size: rendered.size, assetId });
    if (spec.preset === 'original' && spec.format === 'webp') {
      masterWidth = encoded.width; masterHeight = encoded.height; masterSize = encoded.buffer.byteLength;
    }
  }

  await prisma.mediaVariant.createMany({ data: newVariants });

  /* Update blur/color + score */
  let blur = BLUR_FALLBACK;
  try { blur = await computeBlurAndColor(buffer); } catch { /* non-fatal */ }

  const hasWebpVariant = newVariants.some((v) => v.format === 'webp');
  const score = computeMediaScore({
    alt: asset.alt, keywords: asset.keywords, mimeType: asset.mimeType,
    size: masterSize, width: masterWidth, height: masterHeight,
    variantCount: newVariants.length, hasWebpVariant,
  });

  await prisma.mediaAsset.update({
    where: { id: assetId },
    data: {
      width: masterWidth, height: masterHeight, size: masterSize,
      blurDataURL: blur.blurDataURL ?? null, dominantColor: blur.dominantColor ?? null,
      optimizationScore: score.total, compressionRatio: masterSize / (buffer.byteLength || 1),
      processingStatus: 'done',
    },
  });
}

/* ── ai_meta: generate alt/caption/keywords via AI Vision ── */
async function runAiMeta(assetId: string, params: Record<string, unknown>) {
  /* Check AI is configured (reads DB settings) */
  if (!(await isAiVisionEnabled())) {
    throw new Error('AI Vision not configured — set provider + API key in admin panel (🛠 Tools)');
  }

  const asset = await prisma.mediaAsset.findUnique({
    where:  { id: assetId },
    select: { id: true, url: true, originalName: true, context: true, folder: true, mimeType: true, alt: true, title: true, caption: true, keywords: true },
  });
  if (!asset) throw new Error(`Asset ${assetId} not found`);
  if (!asset.mimeType.startsWith('image/')) return;  // skip videos

  /* Skip if already has alt unless force flag is set */
  const force = params.force === true;
  if (asset.alt && !force) return;

  /* Read image bytes (works for local + remote URLs) */
  const buffer = await readImageBuffer(asset.url);
  if (!buffer) throw new Error(`Could not read image from ${asset.url}`);

  const result = await generateImageMeta(
    { buffer, mimeType: asset.mimeType },
    { context: asset.context, folder: asset.folder, filename: asset.originalName },
  );
  if (!result) throw new Error('AI Vision returned no result');

  /* Only overwrite fields that are currently empty (unless force) */
  const data: Record<string, unknown> = {};
  if (!asset.alt     || force) data.alt      = result.alt;
  if (!asset.caption || force) data.caption  = result.caption ?? null;
  if ((!asset.title || force) && result.title) data.title = result.title;
  if ((!asset.keywords?.length || force) && result.keywords?.length) {
    data.keywords = result.keywords;
  }

  if (Object.keys(data).length > 0) {
    await prisma.mediaAsset.update({ where: { id: assetId }, data });
  }
}
