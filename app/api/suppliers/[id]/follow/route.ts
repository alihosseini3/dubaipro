/**
 * GET    /api/suppliers/[id]/follow — viewer's follow state + counter.
 * POST   /api/suppliers/[id]/follow — start following (idempotent).
 * DELETE /api/suppliers/[id]/follow — stop following (idempotent).
 *
 * Counter mutations are transactional inside the service. Anonymous
 * users hit a 401 on POST/DELETE; GET works anonymously and reports
 * `following=false` for guests so the storefront can pre-render.
 */
import { NextResponse } from 'next/server';

import { handlePrismaError, notFound } from '@/lib/api/errors';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import {
  followSupplier,
  isFollowing,
  resolveActiveSupplierIdByParam,
  unfollowSupplier
} from '@/lib/suppliers';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id: idOrSlug } = await params;

  try {
    const resolved = await resolveActiveSupplierIdByParam(idOrSlug);
    if (!resolved) return notFound('Supplier not found');

    const user = await getCurrentUser();
    const counterRow = await prisma.supplier.findUnique({
      where: { id: resolved.id },
      select: { followerCount: true }
    });
    const followerCount = counterRow?.followerCount ?? 0;

    const following = user ? await isFollowing(resolved.id, user.id) : false;

    return NextResponse.json({
      data: { following, followerCount }
    });
  } catch (error) {
    return handlePrismaError(error, `GET /api/suppliers/${idOrSlug}/follow`);
  }
}

export async function POST(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id: idOrSlug } = await params;
  try {
    const resolved = await resolveActiveSupplierIdByParam(idOrSlug);
    if (!resolved) return notFound('Supplier not found');

    const state = await followSupplier(resolved.id, user.id);
    return NextResponse.json({ data: state });
  } catch (error) {
    return handlePrismaError(error, `POST /api/suppliers/${idOrSlug}/follow`);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id: idOrSlug } = await params;
  try {
    const resolved = await resolveActiveSupplierIdByParam(idOrSlug);
    if (!resolved) return notFound('Supplier not found');

    const state = await unfollowSupplier(resolved.id, user.id);
    return NextResponse.json({ data: state });
  } catch (error) {
    return handlePrismaError(error, `DELETE /api/suppliers/${idOrSlug}/follow`);
  }
}
