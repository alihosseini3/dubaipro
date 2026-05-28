import { NextResponse } from 'next/server';

import { getAdminOrNull } from '@/lib/auth/require-admin';
import { badRequest, handlePrismaError } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';
import { deleteAuction, updateAuction } from '@/lib/auctions/service';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

const VALID_STATUS = new Set([
  'DRAFT',
  'SCHEDULED',
  'LIVE',
  'ENDED',
  'CANCELLED'
]);

type PatchBody = {
  slug?: unknown;
  title?: unknown;
  description?: unknown;
  imageUrl?: unknown;
  startingBid?: unknown;
  reservePrice?: unknown;
  minIncrement?: unknown;
  currency?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
  supplierId?: unknown;
  categoryId?: unknown;
  status?: unknown;
  galleryUrls?: unknown;
};

export async function PATCH(request: Request, { params }: Params) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const parsed = await parseJsonBody<PatchBody>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const body = parsed.data;

  const startsAt =
    body.startsAt === undefined
      ? undefined
      : new Date(String(body.startsAt));
  const endsAt =
    body.endsAt === undefined ? undefined : new Date(String(body.endsAt));
  if (startsAt && Number.isNaN(startsAt.getTime())) {
    return badRequest('startsAt must be a valid ISO timestamp');
  }
  if (endsAt && Number.isNaN(endsAt.getTime())) {
    return badRequest('endsAt must be a valid ISO timestamp');
  }

  try {
    const data = await updateAuction(id, {
      slug: typeof body.slug === 'string' ? body.slug : undefined,
      title: typeof body.title === 'string' ? body.title : undefined,
      description:
        body.description === undefined
          ? undefined
          : typeof body.description === 'string'
            ? body.description
            : null,
      imageUrl:
        body.imageUrl === undefined
          ? undefined
          : typeof body.imageUrl === 'string'
            ? body.imageUrl
            : null,
      startingBid:
        typeof body.startingBid === 'number' && body.startingBid > 0
          ? body.startingBid
          : undefined,
      minIncrement:
        typeof body.minIncrement === 'number' && body.minIncrement > 0
          ? body.minIncrement
          : undefined,
      currency:
        typeof body.currency === 'string' ? body.currency : undefined,
      startsAt,
      endsAt,
      supplierId:
        body.supplierId === undefined
          ? undefined
          : typeof body.supplierId === 'string'
            ? body.supplierId
            : null,
      categoryId:
        body.categoryId === undefined
          ? undefined
          : typeof body.categoryId === 'string'
            ? body.categoryId
            : null,
      reservePrice:
        body.reservePrice === undefined
          ? undefined
          : typeof body.reservePrice === 'number' && body.reservePrice > 0
            ? body.reservePrice
            : null,
      galleryUrls: Array.isArray(body.galleryUrls)
        ? body.galleryUrls.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
        : undefined,
      status:
        typeof body.status === 'string' && VALID_STATUS.has(body.status)
          ? (body.status as 'DRAFT' | 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED')
          : undefined
    });
    return NextResponse.json({ data });
  } catch (error) {
    return handlePrismaError(error, `PATCH /api/admin/auctions/${id}`);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    await deleteAuction(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handlePrismaError(error, `DELETE /api/admin/auctions/${id}`);
  }
}
