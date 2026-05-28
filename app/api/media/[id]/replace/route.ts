/**
 * POST /api/media/[id]/replace
 *
 * Replaces the physical files of an existing asset in-place.
 * The asset id, url, thumbnailUrl, and all variant URLs are preserved
 * so no downstream references break. Only the pixel data + metadata change.
 *
 * Body: multipart/form-data  { file: File, quality?: number }
 */

import { NextResponse } from 'next/server';
import sharp from 'sharp';

import { badRequest, handlePrismaError, notFound } from '@/lib/api/errors';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import { computeBlurAndColor, BLUR_FALLBACK } from '@/lib/media/blur';
import { buildVariantSpecs } from '@/lib/media/variants';
import { encodeVariant } from '@/lib/media/formats';
import { computeMediaScore } from '@/lib/media/score';
import { storageAdapter } from '@/lib/media/store/index';
import { MEDIA_PUBLIC_DIR } from '@/lib/media/store/fs-store';
import { prisma } from '@/lib/prisma';
import type { MediaFormat } from '@/lib/media/types';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: RouteContext) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await ctx.params;

  const asset = await prisma.mediaAsset.findUnique({
    where: { id },
    include: { variants: { orderBy: [{ preset: 'asc' }, { format: 'asc' }] } },
  });
  if (!asset) return notFound('Asset not found');

  const form = await request.formData().catch(() => null);
  if (!form) return badRequest('multipart/form-data required');

  const file = form.get('file');
  if (!(file instanceof File)) return badRequest('file field required');

  const quality = Math.min(100, Math.max(1, parseInt(String(form.get('quality') ?? '82'), 10)));

  try {
    const buffer  = Buffer.from(await file.arrayBuffer());
    const meta    = await sharp(buffer, { failOn: 'error' }).rotate().metadata();
    const formats: MediaFormat[] = ['webp', 'avif'];
    const specs   = buildVariantSpecs(asset.width ?? 2400, formats);

    /* ── Re-encode and overwrite every existing variant at its original filename ── */
    let masterWidth = asset.width ?? 0;
    let masterHeight = asset.height ?? 0;
    let masterSize = asset.size;

    const updatedVariants: { id: string; width: number; height: number; size: number }[] = [];

    for (const variant of asset.variants) {
      const spec = specs.find((s) => s.preset === variant.preset && s.format === variant.format);
      if (!spec) continue;

      // Skip if new source would be upscaled
      const srcW = meta.width ?? 0;
      if (srcW > 0 && spec.width > srcW && spec.width > 0) continue;

      const effectiveSpec = spec.preset === 'original' ? { ...spec, quality } : spec;
      const encoded = await encodeVariant(buffer, effectiveSpec, { stripMeta: true });

      // Derive filename from existing URL
      const filename = variant.url.startsWith(`${MEDIA_PUBLIC_DIR}/`)
        ? variant.url.slice(MEDIA_PUBLIC_DIR.length + 1)
        : variant.url.split('/').pop()!;

      await storageAdapter.put({ filename, buffer: encoded.buffer, mimeType: `image/${variant.format}` });

      if (variant.preset === 'original' && variant.format === 'webp') {
        masterWidth  = encoded.width;
        masterHeight = encoded.height;
        masterSize   = encoded.buffer.byteLength;
      }

      updatedVariants.push({ id: variant.id, width: encoded.width, height: encoded.height, size: encoded.buffer.byteLength });
    }

    /* ── Compute blur / dominant color ── */
    let blur = BLUR_FALLBACK;
    try { blur = await computeBlurAndColor(buffer); } catch { /* non-fatal */ }

    const score = computeMediaScore({
      alt:          asset.alt,
      keywords:     asset.keywords,
      mimeType:     asset.mimeType,
      size:         masterSize,
      width:        masterWidth,
      height:       masterHeight,
      variantCount: asset.variants.length,
    });

    /* ── Update DB ── */
    await prisma.$transaction([
      prisma.mediaAsset.update({
        where: { id },
        data: {
          width:             masterWidth,
          height:            masterHeight,
          size:              masterSize,
          blurDataURL:       blur.blurDataURL ?? null,
          dominantColor:     blur.dominantColor ?? null,
          optimizationScore: score.total,
          hash:              null, // invalidate hash so duplicate detection is reset
          processingStatus:  'done',
        },
      }),
      ...updatedVariants.map((v) =>
        prisma.mediaVariant.update({
          where: { id: v.id },
          data:  { width: v.width, height: v.height, size: v.size },
        })
      ),
    ]);

    return NextResponse.json({ ok: true, width: masterWidth, height: masterHeight, size: masterSize });
  } catch (error) {
    return handlePrismaError(error, 'POST /api/media/[id]/replace');
  }
}
