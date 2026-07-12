/**
 * GET  /api/supplier/me/certifications — list all certs (any status).
 * POST /api/supplier/me/certifications — upload metadata of a new cert.
 *
 * The actual file upload happens via the existing MediaAsset pipeline;
 * this endpoint only persists the URL + admin-review metadata. New rows
 * start in `PENDING` and must be approved by an admin to appear on the
 * public storefront.
 */
import { NextResponse } from 'next/server';

import {
  badRequest,
  handlePrismaError
} from '@/lib/api/errors';
import {
  isNonEmptyString,
  parseJsonBody,
  type ValidationErrors
} from '@/lib/api/validation';
import { getSupplierContextOrNull } from '@/lib/auth/require-supplier';
import { memberHasPermission } from '@/lib/auth/permissions';
import {
  createCertification,
  listSupplierCertifications
} from '@/lib/suppliers';

export const runtime = 'nodejs';

const MAX_TITLE = 200;
const MAX_TYPE = 64;
const MAX_ISSUER = 200;

export async function GET() {
  const ctx = await getSupplierContextOrNull();
  if (!ctx) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  try {
    const rows = await listSupplierCertifications(ctx.supplier.id);
    return NextResponse.json({ data: rows });
  } catch (error) {
    return handlePrismaError(error, 'GET /api/supplier/me/certifications');
  }
}

type CreateBody = {
  type?: unknown;
  title?: unknown;
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

export async function POST(request: Request) {
  const ctx = await getSupplierContextOrNull();
  if (!ctx) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (!memberHasPermission(ctx.member.role, 'supplier.profile.manage', ctx.member.permissions)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const parsed = await parseJsonBody<CreateBody>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const body = parsed.data;

  const errors: ValidationErrors = {};

  if (!isNonEmptyString(body.title) || body.title.length > MAX_TITLE) {
    errors.title = `title must be 1..${MAX_TITLE} chars`;
  }
  if (!isNonEmptyString(body.type) || body.type.length > MAX_TYPE) {
    errors.type = `type must be 1..${MAX_TYPE} chars`;
  }
  if (!isNonEmptyString(body.fileUrl)) {
    errors.fileUrl = 'fileUrl is required';
  }
  if (body.issuer !== undefined && body.issuer !== null) {
    if (typeof body.issuer !== 'string' || body.issuer.length > MAX_ISSUER) {
      errors.issuer = `issuer must be ≤ ${MAX_ISSUER} chars`;
    }
  }
  if (body.thumbUrl !== undefined && body.thumbUrl !== null && typeof body.thumbUrl !== 'string') {
    errors.thumbUrl = 'thumbUrl must be a string';
  }
  const issuedParsed = parseDate(body.issuedAt);
  if (!issuedParsed.ok) errors.issuedAt = 'issuedAt must be ISO date';
  const expiresParsed = parseDate(body.expiresAt);
  if (!expiresParsed.ok) errors.expiresAt = 'expiresAt must be ISO date';

  if (body.order !== undefined && (typeof body.order !== 'number' || !Number.isInteger(body.order))) {
    errors.order = 'order must be an integer';
  }

  if (Object.keys(errors).length > 0) {
    return badRequest('Validation failed', errors);
  }

  try {
    const row = await createCertification({
      supplierId: ctx.supplier.id,
      type: (body.type as string).trim(),
      title: (body.title as string).trim(),
      issuer: typeof body.issuer === 'string' ? body.issuer.trim() : null,
      fileUrl: body.fileUrl as string,
      thumbUrl: typeof body.thumbUrl === 'string' ? body.thumbUrl : null,
      issuedAt: issuedParsed.ok ? issuedParsed.date : null,
      expiresAt: expiresParsed.ok ? expiresParsed.date : null,
      order: typeof body.order === 'number' ? body.order : 0
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (error) {
    return handlePrismaError(error, 'POST /api/supplier/me/certifications');
  }
}
