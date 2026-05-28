import { unlink } from 'node:fs/promises';
import path from 'node:path';

import { NextResponse } from 'next/server';

import { badRequest, handlePrismaError } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

type PatchBody = {
  alt?: unknown;
  title?: unknown;
  caption?: unknown;
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
  if (body.alt      !== undefined) data.alt      = typeof body.alt === 'string' ? body.alt.trim().slice(0, 255) || null : null;
  if (body.title    !== undefined) data.title    = typeof body.title === 'string' ? body.title.trim().slice(0, 255) || null : null;
  if (body.caption  !== undefined) data.caption  = typeof body.caption === 'string' ? body.caption.trim().slice(0, 500) || null : null;
  if (body.folder   !== undefined) data.folder   = typeof body.folder === 'string' && body.folder.trim() ? body.folder.trim().slice(0, 64) : 'general';
  if (body.tags     !== undefined) data.tags     = Array.isArray(body.tags) ? (body.tags as unknown[]).filter((t): t is string => typeof t === 'string').map((t) => t.trim()).filter(Boolean) : [];
  if (body.originalName !== undefined) data.originalName = typeof body.originalName === 'string' ? body.originalName.trim().slice(0, 255) || null : null;

  if (Object.keys(data).length === 0) return badRequest('Nothing to update');

  try {
    const asset = await prisma.mediaAsset.update({ where: { id }, data });
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
    const asset = await prisma.mediaAsset.findUnique({ where: { id }, select: { filename: true } });
    if (!asset) return NextResponse.json({ error: 'not found' }, { status: 404 });

    await prisma.mediaAsset.delete({ where: { id } });

    const diskPath = path.join(process.cwd(), 'public', 'uploads', asset.filename);
    await unlink(diskPath).catch(() => { /* file may already be gone */ });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handlePrismaError(error, 'DELETE /api/admin/media/[id]');
  }
}
