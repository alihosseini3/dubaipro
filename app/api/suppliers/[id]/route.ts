import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { badRequest, handlePrismaError, notFound } from '@/lib/api/errors';
import {
  isBoolean,
  isNonEmptyString,
  parseJsonBody,
  type ValidationErrors
} from '@/lib/api/validation';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import {
  getPublicSupplierBySlug,
  incrementProfileViews,
  resolveActiveSupplierIdByParam
} from '@/lib/suppliers';

export const runtime = 'nodejs';

type UpdateSupplierBody = {
  name?: unknown;
  country?: unknown;
  phone?: unknown;
  verified?: unknown;
};

type RouteContext = { params: Promise<{ id: string }> };

/** TTL for the per-visitor view-dedup cookie (1 hour). */
const VIEW_COOKIE_TTL = 60 * 60;

/**
 * GET /api/suppliers/[id]
 *
 * Public profile lookup. The `[id]` segment is treated as either a cuid
 * or a slug. Only `status=ACTIVE` rows are visible. Increments
 * `profileViews` at most once per (visitor, supplier) per hour using a
 * tiny httpOnly cookie — no shared state required.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { id: idOrSlug } = await context.params;
  const locale = new URL(_request.url).searchParams.get('locale') ?? 'en';

  try {
    // Resolve first to get the canonical slug, then fetch the DTO. Two
    // queries but very cheap and keeps the public DTO selection in one
    // place (`getPublicSupplierBySlug`).
    const resolved = await resolveActiveSupplierIdByParam(idOrSlug);
    if (!resolved || !resolved.slug) return notFound('Supplier not found');

    const supplier = await getPublicSupplierBySlug(resolved.slug, locale);
    if (!supplier) return notFound('Supplier not found');

    // View-dedup: skip counter increment if the cookie marker is present.
    const store = await cookies();
    const cookieName = `sv_${supplier.id}`;
    if (!store.get(cookieName)) {
      await incrementProfileViews(supplier.id);
      store.set(cookieName, '1', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: VIEW_COOKIE_TTL
      });
    }

    return NextResponse.json({ data: supplier });
  } catch (error) {
    return handlePrismaError(error, `GET /api/suppliers/${idOrSlug}`);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const admin = await getAdminOrNull();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;

  const parsed = await parseJsonBody<UpdateSupplierBody>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const body = parsed.data;

  const errors: ValidationErrors = {};
  const data: Record<string, unknown> = {};

  if (body.name !== undefined) {
    if (!isNonEmptyString(body.name)) errors.name = 'name must be non-empty';
    else data.name = body.name.trim();
  }
  if (body.country !== undefined) {
    if (!isNonEmptyString(body.country)) errors.country = 'country must be non-empty';
    else data.country = body.country.trim();
  }
  if (body.verified !== undefined) {
    if (!isBoolean(body.verified)) errors.verified = 'verified must be boolean';
    else data.verified = body.verified;
  }
  if (body.phone !== undefined) {
    if (typeof body.phone !== 'string') errors.phone = 'phone must be string';
    else {
      const digits = body.phone.replace(/\D+/g, '').slice(0, 30);
      data.phone = digits.length === 0 ? null : digits;
    }
  }

  if (Object.keys(errors).length > 0) return badRequest('Validation failed', errors);
  if (Object.keys(data).length === 0) return badRequest('No fields to update');

  try {
    const supplier = await prisma.supplier.update({ where: { id }, data });
    return NextResponse.json({ data: supplier });
  } catch (error) {
    return handlePrismaError(error, `PATCH /api/suppliers/${id}`);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const admin = await getAdminOrNull();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;
  try {
    await prisma.supplier.delete({ where: { id } });
    return NextResponse.json({ data: { id, deleted: true } });
  } catch (error) {
    return handlePrismaError(error, `DELETE /api/suppliers/${id}`);
  }
}
