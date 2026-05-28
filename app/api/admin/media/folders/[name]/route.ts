import { NextResponse } from 'next/server';

import { getAdminOrNull } from '@/lib/auth/require-admin';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ name: string }> };

function sanitize(input: string): string {
  return input.trim().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * PATCH /api/admin/media/folders/[name]
 * Body: { label?: string; newName?: string }
 * Renames a folder (name + label). When `newName` is given all MediaAssets
 * in this folder are also migrated to the new name atomically.
 */
export async function PATCH(request: Request, ctx: Ctx) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { name } = await ctx.params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'invalid body' }, { status: 400 });

  const label = typeof body.label === 'string' ? body.label.trim().slice(0, 128) || null : undefined;
  const rawNew = typeof body.newName === 'string' ? sanitize(body.newName) : undefined;

  if (rawNew && rawNew !== name) {
    const conflict = await prisma.galleryFolder.findUnique({ where: { name: rawNew } });
    if (conflict) return NextResponse.json({ error: 'folder_name_taken' }, { status: 409 });

    const [folder] = await prisma.$transaction([
      prisma.galleryFolder.update({
        where: { name },
        data: { name: rawNew, ...(label !== undefined ? { label } : {}) },
      }),
      prisma.mediaAsset.updateMany({ where: { folder: name }, data: { folder: rawNew } }),
    ]);
    return NextResponse.json({ data: folder });
  }

  if (label !== undefined) {
    const folder = await prisma.galleryFolder.update({ where: { name }, data: { label } });
    return NextResponse.json({ data: folder });
  }

  return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 });
}

/**
 * DELETE /api/admin/media/folders/[name]
 * Deletes a GalleryFolder record. Fails if the folder still has files.
 */
export async function DELETE(_req: Request, ctx: Ctx) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { name } = await ctx.params;

  const fileCount = await prisma.mediaAsset.count({ where: { folder: name } });
  if (fileCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete: folder contains ${fileCount} file${fileCount > 1 ? 's' : ''}` },
      { status: 409 },
    );
  }

  await prisma.galleryFolder.delete({ where: { name } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
