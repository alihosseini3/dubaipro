/**
 * GET    /api/media/[id]   — single asset hydrated with variants + usage count
 * PATCH  /api/media/[id]   — edit SEO metadata + folder + tags + focal point
 * DELETE /api/media/[id]   — remove DB row, all variant rows, and disk files
 */

import { NextResponse } from 'next/server';

import { badRequest, handlePrismaError, notFound } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import {
  clampSeoText,
  isMediaContext,
  normalizeKeywords,
  computeMediaScore,
  type MediaContext,
} from '@/lib/media';
import { deleteMediaFile, MEDIA_PUBLIC_DIR } from '@/lib/media/store/fs-store';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  try {
    const [asset, usageCount] = await Promise.all([
      prisma.mediaAsset.findUnique({
        where: { id },
        include: {
          variants: { orderBy: [{ preset: 'asc' }, { format: 'asc' }] },
          uploadedBy: { select: { id: true, name: true } },
        },
      }),
      prisma.mediaUsage.count({ where: { assetId: id } }),
    ]);
    if (!asset) return notFound('Asset not found');
    return NextResponse.json({ data: { ...asset, usageCount } });
  } catch (error) {
    return handlePrismaError(error, 'GET /api/media/[id]');
  }
}

interface PatchBody {
  alt?:         unknown;
  title?:       unknown;
  seoTitle?:    unknown;
  caption?:     unknown;
  description?: unknown;
  keywords?:    unknown;
  folder?:      unknown;
  tags?:        unknown;
  context?:     unknown;
  focalX?:      unknown;
  focalY?:      unknown;
}

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

  if (body.keywords !== undefined) data.keywords = normalizeKeywords(body.keywords);

  if (body.folder !== undefined) {
    data.folder =
      typeof body.folder === 'string' && body.folder.trim()
        ? body.folder.trim().slice(0, 64)
        : 'general';
  }

  if (body.tags !== undefined) {
    data.tags = Array.isArray(body.tags)
      ? (body.tags as unknown[])
          .filter((t): t is string => typeof t === 'string')
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 32)
      : [];
  }

  if (body.context !== undefined) {
    data.context = isMediaContext(body.context) ? (body.context as MediaContext) : null;
  }

  if (body.focalX !== undefined) {
    const n = Number(body.focalX);
    data.focalX = Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : null;
  }
  if (body.focalY !== undefined) {
    const n = Number(body.focalY);
    data.focalY = Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : null;
  }

  if (Object.keys(data).length === 0) return badRequest('Nothing to update');

  try {
    /* Fetch current asset to compute score with merged values */
    const SEO_KEYS = ['alt', 'keywords', 'tags'];
    const needsRescore = SEO_KEYS.some((k) => k in data);

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
    return handlePrismaError(error, 'PATCH /api/media/[id]');
  }
}

export async function DELETE(request: Request, ctx: RouteContext) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await ctx.params;

  // Allow ?force=1 to bypass the usage guard (admin override).
  const url = new URL(request.url);
  const force = url.searchParams.get('force') === '1';

  try {
    const asset = await prisma.mediaAsset.findUnique({
      where: { id },
      include: { variants: true },
    });
    if (!asset) return notFound('Asset not found');

    if (!force) {
      const usageCount = await prisma.mediaUsage.count({ where: { assetId: id } });
      if (usageCount > 0) {
        return NextResponse.json(
          { error: 'asset_in_use', usageCount },
          { status: 409 },
        );
      }
    }

    // Cascade deletes variant rows + usage rows automatically.
    await prisma.mediaAsset.delete({ where: { id } });

    // Wipe disk files (variants + master). The master URL ends in `/<filename>`
    // — strip the public prefix and unlink each.
    const filenames = new Set<string>();
    if (asset.url.startsWith(`${MEDIA_PUBLIC_DIR}/`)) {
      filenames.add(asset.url.slice(MEDIA_PUBLIC_DIR.length + 1));
    } else {
      // Fallback: legacy rows may store just the filename column.
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
    return handlePrismaError(error, 'DELETE /api/media/[id]');
  }
}
