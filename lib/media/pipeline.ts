/**
 * Smart Media Engine — pipeline orchestrator.
 *
 * Given a raw upload buffer, this module:
 *
 *   1. Hashes the original bytes for duplicate detection.
 *   2. Reads dimensions via Sharp metadata (single pass, EXIF-rotated).
 *   3. Renders the responsive variant ladder × format matrix.
 *   4. Computes a base64 LQIP and dominant color.
 *   5. Persists every rendition to the FS store.
 *   6. Writes one `MediaAsset` row plus the `MediaVariant` rows.
 *   7. Returns a `PipelineResult` to the caller.
 *
 * The function is designed to be called from `app/api/media/upload`
 * but is plain Node — it has no Next.js dependencies, so it can also
 * be reused by a future CLI/cron import script.
 */

import sharp from 'sharp';

import { prisma } from '@/lib/prisma';

import { BLUR_FALLBACK, computeBlurAndColor } from './blur';
import { getMediaContext } from './context';
import {
  buildVariantFilename,
  buildVariantUrl,
  encodeVariant,
  toRenderedVariant,
} from './formats';
import { sha256, shortHash } from './hash';
import { computeMediaScore } from './score';
import { clampSeoText, normalizeKeywords, slugifyFilename } from './seo';
import type { Prisma } from '@prisma/client';
import { MEDIA_PUBLIC_DIR } from './store/fs-store';
import { storageAdapter } from './store/index';
import type {
  MediaFormat,
  PipelineOptions,
  PipelineResult,
  RenderedVariant,
} from './types';
import { buildVariantSpecs } from './variants';

/** Master format served first via <picture>: WebP is the safest default. */
const MASTER_FORMAT: MediaFormat = 'webp';

/**
 * Run the full pipeline for one image upload.
 *
 * @param uploadedById  User id stored on `MediaAsset.uploadedById`.
 *                      Caller MUST validate authorisation upstream.
 */
export async function runMediaPipeline(
  uploadedById: string,
  options: PipelineOptions,
): Promise<PipelineResult> {
  const {
    buffer,
    originalName,
    mimeType,
    context,
    folder,
    quality = 82,
    stripMeta = true,
    skipAvif = false,
    seo,
    tags,
    focal,
    maxDimension,
  } = options;

  // ── 1. Hash + dedupe ──────────────────────────────────────────────────
  const hashFull  = sha256(buffer);
  const hashShort = shortHash(hashFull);

  const existing = await prisma.mediaAsset.findUnique({
    where: { hash: hashFull },
    include: { variants: true },
  });

  if (existing) {
    return {
      id:                existing.id,
      url:               existing.url,
      thumbnailUrl:      existing.thumbnailUrl,
      width:             existing.width  ?? 0,
      height:            existing.height ?? 0,
      originalSize:      buffer.byteLength,
      size:              existing.size,
      compressionRatio:  existing.compressionRatio ?? 0,
      optimizationScore: existing.optimizationScore ?? 0,
      hash:              hashFull,
      duplicate:         true,
      variants: existing.variants.map((v) => ({
        preset:   v.preset as RenderedVariant['preset'],
        format:   v.format as MediaFormat,
        filename: v.url.replace(`${MEDIA_PUBLIC_DIR}/`, ''),
        url:      v.url,
        width:    v.width,
        height:   v.height,
        size:     v.size,
      })),
      blurDataURL:   existing.blurDataURL ?? null,
      dominantColor: existing.dominantColor ?? null,
      mimeType:      existing.mimeType,
    };
  }

  // ── 2. Resolve preset + read source metadata ──────────────────────────
  const ctxConfig    = getMediaContext(context);
  const masterMaxDim = maxDimension ?? ctxConfig.maxDimension;

  const meta = await sharp(buffer, { failOn: 'error' }).rotate().metadata();
  const sourceWidth  = meta.width  ?? 0;
  const sourceHeight = meta.height ?? 0;

  // ── 3. Render variant matrix ──────────────────────────────────────────
  const formats: MediaFormat[] = skipAvif ? ['webp'] : ['webp', 'avif'];
  const specs   = buildVariantSpecs(masterMaxDim, formats);
  const baseSlug = slugifyFilename(originalName);

  const rendered: RenderedVariant[] = [];
  const writtenFilenames: string[] = [];

  // ── 3a. Persist the original file (enables reprocessing later) ────────
  let originalUrl: string | null = null;
  try {
    const origFilename = `${baseSlug}-${hashShort}-original-src.${meta.format ?? 'bin'}`;
    const origResult   = await storageAdapter.put({ filename: origFilename, buffer, mimeType });
    originalUrl        = origResult.url;
    writtenFilenames.push(origFilename);
  } catch (err) {
    console.warn('Failed to store original file (non-fatal):', err);
  }

  try {
    for (const spec of specs) {
      // Skip presets that would upscale beyond the source.
      if (sourceWidth > 0 && spec.width > sourceWidth && spec.width > 0) {
        continue;
      }
      // Override quality with the caller's master quality on the
      // `original` preset so admins can tune one knob.
      const effectiveSpec =
        spec.preset === 'original' ? { ...spec, quality } : spec;

      const encoded = await encodeVariant(buffer, effectiveSpec, { stripMeta });
      const filename = buildVariantFilename(
        baseSlug,
        hashShort,
        effectiveSpec.preset,
        effectiveSpec.format,
      );
      const { url } = await storageAdapter.put({ filename, buffer: encoded.buffer, mimeType: `image/${effectiveSpec.format}` });
      writtenFilenames.push(filename);
      rendered.push(toRenderedVariant(effectiveSpec, encoded, filename, url));
    }

    // ── 4. Pick the master + thumbnail rows ────────────────────────────
    const master =
      rendered.find((v) => v.preset === 'original' && v.format === MASTER_FORMAT) ??
      rendered.find((v) => v.preset === 'original') ??
      rendered[rendered.length - 1];

    if (!master) {
      throw new Error('Pipeline produced no variants');
    }

    const thumb =
      rendered.find((v) => v.preset === 'thumb' && v.format === MASTER_FORMAT) ??
      rendered.find((v) => v.preset === 'thumb') ??
      null;

    // ── 5. Blur placeholder + dominant color (non-fatal) ────────────────
    let blur = BLUR_FALLBACK;
    try {
      blur = await computeBlurAndColor(buffer);
    } catch (err) {
      console.warn('blur computation failed (non-fatal):', err);
    }

    // ── 5a. Extract full EXIF for storage ────────────────────────────────
    let exifData: Record<string, unknown> | null = null;
    try {
      const exifMeta = await sharp(buffer, { failOn: 'none' }).metadata();
      // Only store non-pixel fields (no raw channels/histograms).
      exifData = {
        format:        exifMeta.format,
        space:         exifMeta.space,
        channels:      exifMeta.channels,
        depth:         exifMeta.depth,
        density:       exifMeta.density,
        hasAlpha:      exifMeta.hasAlpha,
        orientation:   exifMeta.orientation,
        chromaSubsampling: exifMeta.chromaSubsampling,
        isProgressive: exifMeta.isProgressive,
        pages:         exifMeta.pages,
      };
    } catch { /* non-fatal */ }

    // ── 6. Score + persisted SEO inputs ────────────────────────────────
    const cleanKeywords = normalizeKeywords(seo?.keywords);
    const cleanAlt      = clampSeoText(seo?.alt,         255);
    const cleanTitle    = clampSeoText(seo?.title,       255);
    const cleanCaption  = clampSeoText(seo?.caption,     500);
    const cleanSeoTitle = clampSeoText(seo?.seoTitle,    160);
    const cleanDesc     = clampSeoText(seo?.description, 500);

    const score = computeMediaScore({
      alt:            cleanAlt,
      keywords:       cleanKeywords,
      mimeType:       `image/${master.format}`,
      size:           master.size,
      width:          master.width,
      height:         master.height,
      variantCount:   rendered.length,
      hasWebpVariant: rendered.some((v) => v.format === 'webp' || v.format === 'avif'),
      minWidth:       ctxConfig.minWidth,
      minHeight:      ctxConfig.minHeight,
    });

    const compressionRatio =
      buffer.byteLength > 0
        ? Math.max(0, Math.min(1, 1 - master.size / buffer.byteLength))
        : 0;

    // ── 7. Persist DB rows in a single transaction ─────────────────────
    const cleanTags = Array.isArray(tags)
      ? tags
          .filter((t): t is string => typeof t === 'string')
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 32)
      : [];

    const created = await prisma.$transaction(async (tx) => {
      const asset = await tx.mediaAsset.create({
        data: {
          filename:          master.filename,
          originalName:      originalName.slice(0, 255),
          url:               master.url,
          thumbnailUrl:      thumb?.url ?? null,
          mimeType:          `image/${master.format}`,
          size:              master.size,
          width:             master.width,
          height:            master.height,
          alt:               cleanAlt,
          title:             cleanTitle,
          caption:           cleanCaption,
          folder:            (folder ?? ctxConfig.defaultFolder).slice(0, 64),
          tags:              cleanTags,
          uploadedById,
          seoTitle:          cleanSeoTitle,
          description:       cleanDesc,
          keywords:          cleanKeywords,
          dominantColor:     blur.dominantColor || null,
          blurDataURL:       blur.blurDataURL || null,
          hash:              hashFull,
          focalX:            focal?.x ?? null,
          focalY:            focal?.y ?? null,
          context:           context ?? null,
          optimizationScore: score.total,
          compressionRatio,
          processingStatus:  'done',
          storageProvider:   storageAdapter.providerName,
          originalUrl,
          exifData:          (exifData ?? undefined) as Prisma.InputJsonValue | undefined,
          metadata: {
            sourceWidth,
            sourceHeight,
            sourceFormat: meta.format ?? null,
            sourceMime:   mimeType,
          },
        },
      });

      if (rendered.length > 0) {
        await tx.mediaVariant.createMany({
          data: rendered.map((v) => ({
            assetId: asset.id,
            preset:  v.preset,
            format:  v.format,
            url:     v.url,
            width:   v.width,
            height:  v.height,
            size:    v.size,
          })),
          skipDuplicates: true,
        });
      }

      return asset;
    });

    return {
      id:                created.id,
      url:               master.url,
      thumbnailUrl:      thumb?.url ?? null,
      width:             master.width,
      height:            master.height,
      originalSize:      buffer.byteLength,
      size:              master.size,
      compressionRatio,
      optimizationScore: score.total,
      hash:              hashFull,
      duplicate:         false,
      variants:          rendered,
      blurDataURL:       blur.blurDataURL || null,
      dominantColor:     blur.dominantColor || null,
      mimeType:          `image/${master.format}`,
    };
  } catch (err) {
    // Best-effort rollback of any files written before the failure.
    if (writtenFilenames.length > 0) {
      await storageAdapter.deleteMany(writtenFilenames).catch(() => {
        /* ignore — already in error path */
      });
    }
    throw err;
  }
}
