/**
 * POST /api/media/reprocess/[id]
 *
 * Re-runs the image pipeline on an existing MediaAsset using the stored
 * original file (MediaAsset.originalUrl). If originalUrl is null (legacy
 * asset uploaded before P1), the endpoint re-runs from the largest
 * available variant instead.
 *
 * Body (JSON, all optional):
 *   quality    — master quality override (30-100)
 *   skipAvif   — boolean
 *   context    — MediaContext key
 */

import path from 'node:path';
import { readFile } from 'node:fs/promises';

import { NextResponse } from 'next/server';

import { badRequest, handlePrismaError, notFound } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import { isMediaContext, runMediaPipeline, type MediaContext } from '@/lib/media';
import { MEDIA_PUBLIC_DIR } from '@/lib/media/store/fs-store';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const maxDuration = 120;

type RouteContext = { params: Promise<{ id: string }> };

interface Body {
  quality?:  unknown;
  skipAvif?: unknown;
  context?:  unknown;
}

export async function POST(request: Request, ctx: RouteContext) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await ctx.params;

  const asset = await prisma.mediaAsset.findUnique({
    where:   { id },
    include: {
      variants: { orderBy: [{ width: 'desc' }], take: 1 },
    },
  });
  if (!asset) return notFound('Asset not found');

  // Parse options from body
  const parsed = await parseJsonBody<Body>(request).catch(() => ({ ok: true as const, data: {} as Body }));
  if (!parsed.ok) return badRequest(parsed.error);
  const body = parsed.data;

  const quality  = typeof body.quality  === 'number' && body.quality >= 30 && body.quality <= 100 ? body.quality : 82;
  const skipAvif = body.skipAvif === true;
  const ctxRaw   = body.context;
  const context: MediaContext | undefined = isMediaContext(ctxRaw) ? ctxRaw : (asset.context as MediaContext | null ?? undefined);

  // Resolve the source buffer: prefer stored original, fall back to largest variant
  let buffer: Buffer;
  let sourceMime = asset.mimeType;

  try {
    if (asset.originalUrl) {
      const relPath = asset.originalUrl.startsWith(MEDIA_PUBLIC_DIR)
        ? asset.originalUrl.slice(MEDIA_PUBLIC_DIR.length + 1)
        : asset.originalUrl;
      buffer     = await readFile(path.join(process.cwd(), 'public', 'uploads', relPath));
    } else if (asset.variants.length > 0) {
      const variant    = asset.variants[0];
      const relPath    = variant.url.startsWith(MEDIA_PUBLIC_DIR)
        ? variant.url.slice(MEDIA_PUBLIC_DIR.length + 1)
        : variant.url;
      buffer     = await readFile(path.join(process.cwd(), 'public', 'uploads', relPath));
      sourceMime = `image/${variant.format}`;
    } else {
      return badRequest('No source file available for reprocessing');
    }
  } catch {
    return NextResponse.json({ error: 'source_file_not_found' }, { status: 422 });
  }

  // Mark asset as processing
  await prisma.mediaAsset.update({
    where: { id },
    data:  { processingStatus: 'processing' },
  });

  try {
    const result = await runMediaPipeline(admin.id, {
      buffer,
      originalName: asset.originalName,
      mimeType:     sourceMime,
      context,
      quality,
      skipAvif,
      seo: {
        alt:         asset.alt         ?? undefined,
        title:       asset.title       ?? undefined,
        seoTitle:    asset.seoTitle    ?? undefined,
        caption:     asset.caption     ?? undefined,
        description: asset.description ?? undefined,
        keywords:    asset.keywords,
      },
      tags:  asset.tags,
      focal: asset.focalX != null && asset.focalY != null
        ? { x: asset.focalX, y: asset.focalY }
        : undefined,
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    await prisma.mediaAsset.update({
      where: { id },
      data:  { processingStatus: 'failed' },
    }).catch(() => null);
    return handlePrismaError(error, 'POST /api/media/reprocess/[id]');
  }
}
