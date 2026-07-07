import { NextResponse } from 'next/server';

import { badRequest, handlePrismaError, notFound } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import { clampSeoText, normalizeKeywords, computeMediaScore } from '@/lib/media';
import { deleteMediaFile, MEDIA_PUBLIC_DIR } from '@/lib/media/store/fs-store';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

type PatchBody = {
  alt?: unknown;
  title?: unknown;
  seoTitle?: unknown;
  caption?: unknown;
  description?: unknown;
  keywords?: unknown;
  folder?: unknown;
  tags?: unknown;
  originalName?: unknown;
};

export async function PATCH(request: Request, ctx: RouteContext) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const parsed = await parseJsonBody<PatchBody>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const body = parsed.data;

  const data: Record<string, unknown> = {};
  if (body.alt         !== undefined) data.alt         = clampSeoText(body.alt,         255);
  if (body.title       !== undefined) data.title       = clampSeoText(body.title,       255);
  if (body.seoTitle    !== undefined) data.seoTitle    = clampSeoText(body.seoTitle,    160);
  if (body.caption     !== undefined) data.caption     = clampSeoText(body.caption,     500);
  if (body.description !== undefined) data.description = clampSeoText(body.description, 500);
  if (body.keywords    !== undefined) data.keywords    = normalizeKeywords(body.keywords);
  if (body.folder      !== undefined) data.folder      = typeof body.folder === 'string' && body.folder.trim() ? body.folder.trim().slice(0, 64) : 'general';
  if (body.tags        !== undefined) data.tags        = Array.isArray(body.tags) ? (body.tags as unknown[]).filter((t): t is string => typeof t === 'string').map((t) => t.trim()).filter(Boolean).slice(0, 32) : [];
  if (body.originalName !== undefined) data.originalName = typeof body.originalName === 'string' ? body.originalName.trim().slice(0, 255) || null : null;

  if (Object.keys(data).length === 0) return badRequest('Nothing to update');

  try {
    /* Rescore when SEO-affecting fields change, to stay in sync with /api/media/[id]. */
    const needsRescore = ['alt', 'keywords', 'tags'].some((k) => k in data);

    let asset = await prisma.mediaAsset.update({ where: { id }, data });

    if (needsRescore) {
      const variantCount = await prisma.mediaVariant.count({ where: { assetId: id } });
      const score = computeMediaScore({
        alt:          asset.alt,
        keywords:     asset.keywords,
        mimeType:     asset.mimeType,
        size:         asset.size,
        width:        asset.width,
        height:       asset.height,
        variantCount,
      });
      asset = await prisma.mediaAsset.update({
        where: { id },
        data:  { optimizationScore: score.total },
      });
    }

    return NextResponse.json({ data: asset });
  } catch (error) {
    return handlePrismaError(error, 'PATCH /api/admin/media/[id]');
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await ctx.params;

  try {
    const asset = await prisma.mediaAsset.findUnique({
      where: { id },
      include: { variants: { select: { url: true } } },
    });
    if (!asset) return notFound('Asset not found');

    /* Cascade removes variant + usage rows. */
    await prisma.mediaAsset.delete({ where: { id } });

    /* Wipe master + thumbnail + every variant file from storage. */
    const filenames = new Set<string>();
    if (asset.url.startsWith(`${MEDIA_PUBLIC_DIR}/`)) {
      filenames.add(asset.url.slice(MEDIA_PUBLIC_DIR.length + 1));
    } else {
      filenames.add(asset.filename);
    }
    if (asset.thumbnailUrl?.startsWith(`${MEDIA_PUBLIC_DIR}/`)) {
      filenames.add(asset.thumbnailUrl.slice(MEDIA_PUBLIC_DIR.length + 1));
    }
    for (const v of asset.variants) {
      if (v.url.startsWith(`${MEDIA_PUBLIC_DIR}/`)) {
        filenames.add(v.url.slice(MEDIA_PUBLIC_DIR.length + 1));
      }
    }

    await Promise.all([...filenames].map(deleteMediaFile));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handlePrismaError(error, 'DELETE /api/admin/media/[id]');
  }
}
