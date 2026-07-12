/**
 * PUT    /api/supplier/me/certifications/[id]
 * DELETE /api/supplier/me/certifications/[id]
 *
 * Suppliers can patch metadata or delete their own pending/expired
 * certifications. Approving / rejecting belongs to the admin route.
 *
 * Ownership is enforced by re-checking `supplierId === ctx.supplier.id`
 * before any mutation.
 */
import { NextResponse } from 'next/server';

import { badRequest, handlePrismaError, notFound } from '@/lib/api/errors';
import {
  parseJsonBody,
  type ValidationErrors
} from '@/lib/api/validation';
import { getSupplierContextOrNull } from '@/lib/auth/require-supplier';
import { memberHasPermission } from '@/lib/auth/permissions';
import { prisma } from '@/lib/prisma';
import {
  deleteCertification,
  updateCertification
} from '@/lib/suppliers';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

type UpdateBody = {
  title?: unknown;
  type?: unknown;
  issuer?: unknown;
  fileUrl?: unknown;
  thumbUrl?: unknown;
  issuedAt?: unknown;
  expiresAt?: unknown;
  order?: unknown;
};

function parseDate(value: unknown): { ok: true; date: Date | null } | { ok: false } {
  if (value === null || value === undefined) return { ok: true, date: null };
  if (typeof value !== 'string') return { ok: false };
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { ok: false };
  return { ok: true, date: d };
}

async function assertOwnership(certId: string, supplierId: string) {
  const row = await prisma.supplierCertification.findUnique({
    where: { id: certId },
    select: { id: true, supplierId: true, status: true }
  });
  return row && row.supplierId === supplierId ? row : null;
}

export async function PUT(request: Request, { params }: Params) {
  const ctx = await getSupplierContextOrNull();
  if (!ctx) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (!memberHasPermission(ctx.member.role, 'supplier.profile.manage', ctx.member.permissions)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const owned = await assertOwnership(id, ctx.supplier.id);
  if (!owned) return notFound('Certification not found');

  const parsed = await parseJsonBody<UpdateBody>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const body = parsed.data;

  const errors: ValidationErrors = {};
  const patch: Parameters<typeof updateCertification>[1] = {};

  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.trim().length === 0) {
      errors.title = 'title must be non-empty';
    } else patch.title = body.title.trim();
  }
  if (body.type !== undefined) {
    if (typeof body.type !== 'string' || body.type.trim().length === 0) {
      errors.type = 'type must be non-empty';
    } else patch.type = body.type.trim();
  }
  if (body.issuer !== undefined) {
    if (body.issuer === null) patch.issuer = null;
    else if (typeof body.issuer !== 'string') errors.issuer = 'issuer must be string';
    else patch.issuer = body.issuer.trim();
  }
  if (body.fileUrl !== undefined) {
    if (typeof body.fileUrl !== 'string' || body.fileUrl.length === 0) {
      errors.fileUrl = 'fileUrl must be non-empty';
    } else patch.fileUrl = body.fileUrl;
  }
  if (body.thumbUrl !== undefined) {
    if (body.thumbUrl === null) patch.thumbUrl = null;
    else if (typeof body.thumbUrl !== 'string') errors.thumbUrl = 'thumbUrl must be string';
    else patch.thumbUrl = body.thumbUrl;
  }
  const issued = parseDate(body.issuedAt);
  if (!issued.ok) errors.issuedAt = 'issuedAt must be ISO date';
  else if (body.issuedAt !== undefined) patch.issuedAt = issued.date;
  const expires = parseDate(body.expiresAt);
  if (!expires.ok) errors.expiresAt = 'expiresAt must be ISO date';
  else if (body.expiresAt !== undefined) patch.expiresAt = expires.date;

  if (body.order !== undefined) {
    if (typeof body.order !== 'number' || !Number.isInteger(body.order)) {
      errors.order = 'order must be integer';
    } else patch.order = body.order;
  }

  if (Object.keys(errors).length > 0) return badRequest('Validation failed', errors);
  if (Object.keys(patch).length === 0) return badRequest('No fields to update');

  try {
    // Editing a previously-approved cert should require re-review. We
    // demote the row to PENDING when any content field changed.
    const contentChanged =
      patch.title !== undefined ||
      patch.type !== undefined ||
      patch.fileUrl !== undefined ||
      patch.issuer !== undefined ||
      patch.issuedAt !== undefined ||
      patch.expiresAt !== undefined;

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.supplierCertification.update({
        where: { id },
        data: patch
      });
      if (contentChanged && row.status === 'APPROVED') {
        return tx.supplierCertification.update({
          where: { id },
          data: { status: 'PENDING', reviewerId: null, reviewerNote: null }
        });
      }
      return row;
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return handlePrismaError(
      error,
      `PUT /api/supplier/me/certifications/${id}`
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const ctx = await getSupplierContextOrNull();
  if (!ctx) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (!memberHasPermission(ctx.member.role, 'supplier.profile.manage', ctx.member.permissions)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const owned = await assertOwnership(id, ctx.supplier.id);
  if (!owned) return notFound('Certification not found');

  try {
    await deleteCertification(id);
    return NextResponse.json({ data: { id, deleted: true } });
  } catch (error) {
    return handlePrismaError(
      error,
      `DELETE /api/supplier/me/certifications/${id}`
    );
  }
}
