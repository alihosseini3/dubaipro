import { NextResponse } from 'next/server';

import { getAdminOrNull } from '@/lib/auth/require-admin';
import { badRequest, handlePrismaError } from '@/lib/api/errors';
import { isNonEmptyString, parseJsonBody } from '@/lib/api/validation';
import { createAuction, listAllAuctions } from '@/lib/auctions/service';

export const runtime = 'nodejs';

export async function GET() {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const data = await listAllAuctions();
    return NextResponse.json({ data });
  } catch (error) {
    return handlePrismaError(error, 'GET /api/admin/auctions');
  }
}

type CreateBody = {
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

const VALID_STATUS = new Set([
  'DRAFT',
  'SCHEDULED',
  'LIVE',
  'ENDED',
  'CANCELLED'
]);

export async function POST(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = await parseJsonBody<CreateBody>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const body = parsed.data;

  if (!isNonEmptyString(body.slug)) return badRequest('slug is required');
  if (!isNonEmptyString(body.title)) return badRequest('title is required');
  const startingBid = Number(body.startingBid);
  if (!Number.isFinite(startingBid) || startingBid <= 0) {
    return badRequest('startingBid must be a positive number');
  }
  const startsAt = new Date(String(body.startsAt));
  const endsAt = new Date(String(body.endsAt));
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return badRequest('startsAt / endsAt must be valid ISO timestamps');
  }
  if (endsAt <= startsAt) {
    return badRequest('endsAt must be after startsAt');
  }

  const status = isNonEmptyString(body.status) && VALID_STATUS.has(body.status)
    ? (body.status as 'DRAFT' | 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED')
    : 'DRAFT';

  try {
    const data = await createAuction({
      slug: body.slug,
      title: body.title,
      description: typeof body.description === 'string' ? body.description : null,
      imageUrl: typeof body.imageUrl === 'string' ? body.imageUrl : null,
      startingBid,
      minIncrement:
        typeof body.minIncrement === 'number' && body.minIncrement > 0
          ? body.minIncrement
          : 1,
      currency:
        typeof body.currency === 'string' ? body.currency : 'AED',
      startsAt,
      endsAt,
      supplierId: typeof body.supplierId === 'string' ? body.supplierId : null,
      categoryId: typeof body.categoryId === 'string' ? body.categoryId : null,
      reservePrice:
        typeof body.reservePrice === 'number' && body.reservePrice > 0
          ? body.reservePrice
          : null,
      galleryUrls: Array.isArray(body.galleryUrls)
        ? body.galleryUrls.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
        : undefined,
      status
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return handlePrismaError(error, 'POST /api/admin/auctions');
  }
}
