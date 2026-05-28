/**
 * GET /api/media/usage/[id]
 *
 * Returns the list of entities that reference a given asset, hydrated
 * with best-effort labels (product title, category name, …). Used by
 * the gallery's "where is this image used?" panel.
 */

import { NextResponse } from 'next/server';

import { handlePrismaError } from '@/lib/api/errors';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import { listAssetUsage } from '@/lib/media';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  try {
    const rows = await listAssetUsage(id);
    return NextResponse.json({ data: rows, total: rows.length });
  } catch (error) {
    return handlePrismaError(error, 'GET /api/media/usage/[id]');
  }
}
