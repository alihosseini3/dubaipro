/**
 * Smart Media Engine — POST /api/media/upload
 *
 * Replaces the legacy `/api/upload` for new admin UI. The legacy
 * endpoint stays in place untouched so existing components keep
 * working during the migration.
 *
 * FormData fields:
 *   file        (required)  the image file
 *   context     (optional)  MediaContext key (product-cover, hero, …)
 *   folder      (optional)  destination folder; defaults to context default
 *   quality     (optional)  master quality 30-100 (default 82)
 *   skipAvif    (optional)  "true" to skip AVIF rendition (faster)
 *   alt         (optional)  SEO alt text
 *   title       (optional)  SEO short title
 *   seoTitle    (optional)  SEO long title (≤160)
 *   caption     (optional)  visible caption (≤500)
 *   description (optional)  long SEO description (≤500)
 *   keywords    (optional)  comma-separated or JSON array
 *   tags        (optional)  comma-separated or JSON array
 *   focalX      (optional)  0..1
 *   focalY      (optional)  0..1
 *   entityType  (optional)  attach the upload to an entity (creates
 *                           one MediaUsage row when entityId+field are
 *                           also present).
 *   entityId    (optional)
 *   field       (optional)
 */

import { NextResponse } from 'next/server';

import { handlePrismaError } from '@/lib/api/errors';
import { uploadLimiter } from '@/lib/media/rate-limit';
import { emitMediaEvent, startTimer } from '@/lib/observability/media-events';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import { getMediaSettings } from '@/lib/media/settings';
import { generateImageMeta } from '@/lib/media/ai-vision';
import { computeMediaScore } from '@/lib/media/score';
import { prisma } from '@/lib/prisma';
import {
  isMediaContext,
  runMediaPipeline,
  trackMediaUsage,
  type MediaContext,
  type MediaUsageEntity,
} from '@/lib/media';
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  isAllowedMimeType,
  isVideoMimeType,
} from '@/lib/upload/config';

export const runtime = 'nodejs';
// Image processing can take >5s for large AVIF runs.
export const maxDuration = 60;

const VALID_ENTITY_TYPES = new Set<MediaUsageEntity>([
  'product', 'category', 'brand', 'page', 'blog', 'hero', 'header',
  'megamenu', 'auction', 'review', 'user', 'banner', 'supplier',
]);

function readString(form: FormData, key: string): string | undefined {
  const v = form.get(key);
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function readNumber(form: FormData, key: string): number | undefined {
  const raw = readString(form, key);
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function readListField(form: FormData, key: string): string[] | undefined {
  const raw = readString(form, key);
  if (!raw) return undefined;
  // Accept JSON array or CSV.
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((v): v is string => typeof v === 'string');
      }
    } catch {
      /* fallthrough to CSV */
    }
  }
  return raw.split(/[,\n]/g).map((s) => s.trim()).filter(Boolean);
}

export async function POST(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const key = `uid:${admin.id}`;
  if (!uploadLimiter.allow(key)) {
    emitMediaEvent({ event: 'rate_limit_hit', userId: admin.id, meta: { endpoint: 'upload' } });
    return NextResponse.json(
      { error: 'too_many_requests', retryAfter: 60 },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }

  const elapsed = startTimer();

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json(
      { error: 'expected multipart/form-data' },
      { status: 400 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'invalid form data' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'empty file' }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES * 8) {
    // Soft guard at 16MB — Sharp can handle bigger but it slows the API.
    return NextResponse.json(
      { error: 'file too large', maxBytes: MAX_IMAGE_BYTES * 8 },
      { status: 413 },
    );
  }

  const mimeType = file.type;
  if (!isAllowedMimeType(mimeType) || isVideoMimeType(mimeType)) {
    return NextResponse.json(
      { error: 'unsupported file type', allowed: ALLOWED_IMAGE_TYPES },
      { status: 415 },
    );
  }

  // ── Read options ─────────────────────────────────────────────────────
  const ctxRaw   = readString(form, 'context');
  const context: MediaContext | undefined = isMediaContext(ctxRaw) ? ctxRaw : undefined;
  const folder   = readString(form, 'folder');
  const quality  = readNumber(form, 'quality');
  const skipAvif = readString(form, 'skipAvif') === 'true';

  const focalX = readNumber(form, 'focalX');
  const focalY = readNumber(form, 'focalY');
  const focal =
    focalX !== undefined && focalY !== undefined
      ? {
          x: Math.max(0, Math.min(1, focalX)),
          y: Math.max(0, Math.min(1, focalY)),
        }
      : undefined;

  const seo = {
    alt:         readString(form, 'alt'),
    title:       readString(form, 'title'),
    seoTitle:    readString(form, 'seoTitle'),
    caption:     readString(form, 'caption'),
    description: readString(form, 'description'),
    keywords:    readListField(form, 'keywords'),
  };
  const tags = readListField(form, 'tags');

  // ── Run pipeline ─────────────────────────────────────────────────────
  let buffer: Buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ error: 'failed to read file' }, { status: 500 });
  }

  emitMediaEvent({ event: 'upload_started', userId: admin.id, mimeType, sizeBytes: file.size });

  try {
    const result = await runMediaPipeline(admin.id, {
      buffer,
      originalName: file.name || 'image',
      mimeType,
      context,
      folder,
      quality,
      skipAvif,
      seo,
      tags,
      focal,
    });

    // Optional: attach to an entity if the caller passed entity info.
    const entityType = readString(form, 'entityType');
    const entityId   = readString(form, 'entityId');
    const field      = readString(form, 'field');
    if (
      entityType &&
      entityId &&
      field &&
      VALID_ENTITY_TYPES.has(entityType as MediaUsageEntity)
    ) {
      await trackMediaUsage({
        assetId:    result.id,
        entityType: entityType as MediaUsageEntity,
        entityId,
        field,
      });
    }

    emitMediaEvent({
      event:     'upload_completed',
      assetId:   result.id,
      userId:    admin.id,
      mimeType,
      sizeBytes: file.size,
      duration:  elapsed(),
      score:     result.optimizationScore ?? undefined,
    });

    /* Auto-fill SEO via AI Vision if enabled and image lacks alt text.
     * Run inline so the asset is saved with title/alt/caption/keywords immediately,
     * which works on local dev where the cron worker is not running. On failure
     * we fall back to scheduling a background job so a worker run can retry. */
    const settings = await getMediaSettings();
    let aiMeta: { alt?: string; title?: string; caption?: string; keywords?: string[]; tags?: string[] } | null = null;
    if (
      settings.ai.enabled &&
      settings.ai.autoGenerate &&
      mimeType.startsWith('image/') &&
      !result.duplicate &&
      !seo.alt
    ) {
      try {
        /* Resolve product/entity context for richer prompts (best-effort) */
        let productName: string | null = null;
        let productDescription: string | null = null;
        let categoryName: string | null = null;
        let brandName: string | null = null;
        if (entityType === 'product' && entityId) {
          try {
            const product = await prisma.product.findUnique({
              where:  { id: entityId },
              select: { title: true, description: true, category: { select: { name: true } }, brand: { select: { name: true } } },
            });
            if (product) {
              productName        = product.title;
              productDescription = product.description?.slice(0, 400) ?? null;
              categoryName       = product.category?.name ?? null;
              brandName          = product.brand?.name ?? null;
            }
          } catch { /* non-fatal */ }
        }

        const vision = await generateImageMeta(
          { buffer, mimeType },
          {
            context: context ?? null,
            folder:  folder ?? null,
            filename: file.name || 'image',
            productName, productDescription, categoryName, brandName,
          },
        );

        if (vision) {
          /* Match AssetDetailPanel's manual AI flow exactly:
           *   - normalise each keyword to trim + lowercase (keep spaces)
           *   - save into BOTH `keywords` (SEO signal) and `tags`
           *     (merged with whatever the admin already provided). */
          const normalisedKeywords = (vision.keywords ?? [])
            .map((k) => k.trim().toLowerCase())
            .filter(Boolean);

          // Debug: Log what AI generated vs what will be saved
          console.log('[upload] AI Vision result:', {
            alt: vision.alt,
            title: vision.title,
            caption: vision.caption,
            keywords: vision.keywords,
            confidence: vision.confidence,
          });

          const data: Record<string, unknown> = {};
          if (vision.alt?.trim())              data.alt      = vision.alt.trim();
          if (vision.title?.trim())            data.title    = vision.title.trim();
          if (vision.caption?.trim())          data.caption  = vision.caption.trim();
          if (normalisedKeywords.length) {
            data.keywords = normalisedKeywords;

            /* Merge with admin-provided tags (de-duped, preserving order). */
            const merged = [...(tags ?? [])];
            const seen   = new Set(merged.map((t) => t.toLowerCase()));
            for (const kw of normalisedKeywords) {
              if (!seen.has(kw)) { seen.add(kw); merged.push(kw); }
            }
            data.tags = merged;
          }
          if (Object.keys(data).length > 0) {
            console.log('[upload] Saving AI metadata to DB:', Object.keys(data));
            try {
              /* Re-compute score with AI-provided alt + keywords so it
               * reflects the real state — pipeline runs before AI. */
              const updatedScore = computeMediaScore({
                alt:            data.alt as string | undefined,
                keywords:       (data.keywords as string[] | undefined) ?? [],
                mimeType:       result.mimeType,
                size:           result.size,
                width:          result.width,
                height:         result.height,
                variantCount:   result.variants?.length ?? 0,
                hasWebpVariant: result.variants?.some((v) => v.format === 'webp' || v.format === 'avif') ?? false,
              });
              data.optimizationScore = updatedScore.total;

              await prisma.mediaAsset.update({ where: { id: result.id }, data });
              result.optimizationScore = updatedScore.total;
              console.log('[upload] AI metadata + score saved successfully. New score:', updatedScore.total);
            } catch (err) {
              console.error('[upload] Failed to save AI metadata:', err);
              // Non-fatal: upload succeeded even if AI meta save failed
            }
          }
          aiMeta = {
            alt:      data.alt as string | undefined,
            title:    data.title as string | undefined,
            caption:  data.caption as string | undefined,
            keywords: data.keywords as string[] | undefined,
            tags:     data.tags as string[] | undefined,
          };
          emitMediaEvent({
            event:   'ai_alt_generated',
            assetId: result.id,
            userId:  admin.id,
            meta:    { provider: vision.provider, confidence: vision.confidence, inline: true },
          });
        } else {
          throw new Error('AI Vision returned no result');
        }
      } catch (err) {
        /* Fallback: schedule a background job so the worker can retry. */
        console.warn('[upload] inline AI meta failed, scheduling job:', err instanceof Error ? err.message : err);
        try {
          await prisma.mediaTransformJob.upsert({
            where: { id: `${result.id}-ai_meta` },
            create: {
              id:          `${result.id}-ai_meta`,
              assetId:     result.id,
              action:      'ai_meta',
              status:      'pending',
              priority:    1,
              params:      { force: false },
              scheduledAt: new Date(),
            },
            update: {},
          });
        } catch (jobErr) {
          console.error('[upload] Failed to schedule AI meta job:', jobErr);
        }
      }
    }

    return NextResponse.json(
      { data: result, ai: aiMeta },
      { status: result.duplicate ? 200 : 201 },
    );
  } catch (error) {
    emitMediaEvent({ event: 'upload_failed', userId: admin.id, mimeType, error: String(error) });
    return handlePrismaError(error, 'POST /api/media/upload');
  }
}
