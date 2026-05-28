/**
 * POST /api/media/bulk
 *
 * Bulk operations for the gallery:
 *   { action: "delete", ids: [...] , force?: boolean }
 *   { action: "move",   ids: [...] , folder: string }
 *   { action: "tag",    ids: [...] , tags: string[],   replace?: boolean }
 *
 * `delete` is "safe" by default — it skips assets currently referenced
 * in MediaUsage. Pass `force: true` to override.
 */

import { NextResponse } from 'next/server';

import { Prisma } from '@prisma/client';

import { badRequest, handlePrismaError } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import { MEDIA_PUBLIC_DIR } from '@/lib/media';
import { deleteMediaFile } from '@/lib/media/store/fs-store';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

interface BulkBody {
  action?:  unknown;
  ids?:     unknown;
  folder?:  unknown;
  tags?:    unknown;
  replace?: unknown;
  force?:   unknown;
  quality?: unknown;
  skipAvif?: unknown;
}

function asStringArray(value: unknown, max = 200): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .slice(0, max);
}

export async function POST(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = await parseJsonBody<BulkBody>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const body = parsed.data;

  const ids = asStringArray(body.ids);
  if (ids.length === 0) return badRequest('ids is required');

  const action = typeof body.action === 'string' ? body.action : '';

  try {
    if (action === 'delete') {
      const force = body.force === true;
      const targets = await prisma.mediaAsset.findMany({
        where: { id: { in: ids } },
        include: {
          variants: { select: { url: true } },
          _count:   { select: { usages: true } },
        },
      });

      const deletable = force
        ? targets
        : targets.filter((t) => t._count.usages === 0);
      const skipped = targets
        .filter((t) => !deletable.includes(t))
        .map((t) => ({ id: t.id, usageCount: t._count.usages }));

      if (deletable.length === 0) {
        return NextResponse.json({ deleted: 0, skipped }, { status: 200 });
      }

      const filenames = new Set<string>();
      for (const a of deletable) {
        if (a.url.startsWith(`${MEDIA_PUBLIC_DIR}/`)) {
          filenames.add(a.url.slice(MEDIA_PUBLIC_DIR.length + 1));
        } else {
          filenames.add(a.filename);
        }
        if (a.thumbnailUrl?.startsWith(`${MEDIA_PUBLIC_DIR}/`)) {
          filenames.add(a.thumbnailUrl.slice(MEDIA_PUBLIC_DIR.length + 1));
        }
        for (const v of a.variants) {
          if (v.url.startsWith(`${MEDIA_PUBLIC_DIR}/`)) {
            filenames.add(v.url.slice(MEDIA_PUBLIC_DIR.length + 1));
          }
        }
      }

      await prisma.mediaAsset.deleteMany({
        where: { id: { in: deletable.map((d) => d.id) } },
      });

      await Promise.all([...filenames].map(deleteMediaFile));

      return NextResponse.json({ deleted: deletable.length, skipped });
    }

    if (action === 'move') {
      const folder =
        typeof body.folder === 'string' && body.folder.trim()
          ? body.folder.trim().slice(0, 64)
          : 'general';
      const result = await prisma.mediaAsset.updateMany({
        where: { id: { in: ids } },
        data:  { folder },
      });
      return NextResponse.json({ updated: result.count, folder });
    }

    if (action === 'tag') {
      const tags    = asStringArray(body.tags, 32).map((t) => t.trim()).filter(Boolean);
      const replace = body.replace === true;

      if (replace) {
        const result = await prisma.mediaAsset.updateMany({
          where: { id: { in: ids } },
          data:  { tags },
        });
        return NextResponse.json({ updated: result.count, tags });
      }

      // Append mode: must read+write per row to merge unique values.
      const targets = await prisma.mediaAsset.findMany({
        where:  { id: { in: ids } },
        select: { id: true, tags: true },
      });
      let updated = 0;
      for (const t of targets) {
        const merged = Array.from(new Set([...t.tags, ...tags])).slice(0, 32);
        await prisma.mediaAsset.update({
          where: { id: t.id },
          data:  { tags: merged },
        });
        updated += 1;
      }
      return NextResponse.json({ updated, tags });
    }

    if (action === 'optimize' || action === 'regenerate') {
      const priority = action === 'regenerate' ? 5 : 0;
      const params: Record<string, unknown> = {};
      if (typeof body.quality === 'number')    params.quality  = body.quality;
      if (body.skipAvif === true)              params.skipAvif = true;

      const jobs = await Promise.all(
        ids.map((id) =>
          prisma.mediaTransformJob.upsert({
            where:  { id: `${id}-${action}` },
            create: { id: `${id}-${action}`, assetId: id, action, priority, params: params as Prisma.InputJsonValue | undefined },
            update: { status: 'pending', startedAt: null, doneAt: null, error: null, attempts: 0 },
          }).catch(() =>
            // fallback: create without forced id (avoids collision if schema changed)
            prisma.mediaTransformJob.create({
              data: { assetId: id, action, priority, params: params as Prisma.InputJsonValue | undefined },
            })
          )
        )
      );
      return NextResponse.json({ scheduled: jobs.length, action });
    }

    return badRequest('Unknown action — use delete | move | tag | optimize | regenerate');
  } catch (error) {
    return handlePrismaError(error, 'POST /api/media/bulk');
  }
}
