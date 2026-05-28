import { NextResponse } from 'next/server';

import { badRequest, handlePrismaError } from '@/lib/api/errors';
import {
  isBoolean,
  isNonEmptyString,
  parseJsonBody,
  type ValidationErrors
} from '@/lib/api/validation';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import { createSupplier, listPublicSuppliers, listSuppliers } from '@/lib/suppliers';
import { parseSupplierListQuery } from '@/lib/suppliers/query';

export const runtime = 'nodejs';

type CreateSupplierBody = {
  userId?: unknown;
  name?: unknown;
  country?: unknown;
  phone?: unknown;
  verified?: unknown;
  slug?: unknown;
};

/**
 * GET /api/suppliers — public storefront listing.
 *
 * - Anonymous: only `status=ACTIVE` rows are returned via DTO (`SupplierCard[]`).
 * - Admin: when authenticated as ADMIN, the full result-set (any status)
 *   is returned to power the admin list page without a second endpoint.
 *
 * Query (all optional, validated):
 *   q, country, tier, businessType, featured(true|false),
 *   sort(recent|top-rated|most-followed|name), page, pageSize
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filters = parseSupplierListQuery(searchParams);
    const admin = await getAdminOrNull();

    const result = admin
      ? await listSuppliers(filters)
      : await listPublicSuppliers(filters);

    return NextResponse.json(result);
  } catch (error) {
    return handlePrismaError(error, 'GET /api/suppliers');
  }
}

export async function POST(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const parsed = await parseJsonBody<CreateSupplierBody>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const body = parsed.data;

  const errors: ValidationErrors = {};
  if (!isNonEmptyString(body.userId)) errors.userId = 'userId is required';
  if (!isNonEmptyString(body.name)) errors.name = 'name is required';
  if (!isNonEmptyString(body.country)) errors.country = 'country is required';
  if (body.verified !== undefined && !isBoolean(body.verified)) {
    errors.verified = 'verified must be boolean';
  }

  if (Object.keys(errors).length > 0) return badRequest('Validation failed', errors);

  try {
    const phone =
      typeof body.phone === 'string'
        ? body.phone.replace(/\D+/g, '').slice(0, 30) || null
        : null;

    const supplier = await createSupplier({
      userId: body.userId as string,
      name: (body.name as string).trim(),
      country: (body.country as string).trim(),
      phone,
      slug: typeof body.slug === 'string' && body.slug.length > 0 ? body.slug : null
    });

    return NextResponse.json({ data: supplier }, { status: 201 });
  } catch (error) {
    return handlePrismaError(error, 'POST /api/suppliers');
  }
}
