/**
 * GET /api/suppliers/[id]/certifications
 *
 * Lists APPROVED certifications for an ACTIVE supplier. PENDING /
 * REJECTED / EXPIRED documents are deliberately hidden from public
 * callers — supplier admins see all of them via /api/supplier/me/certifications.
 */
import { NextResponse } from 'next/server';

import { handlePrismaError, notFound } from '@/lib/api/errors';
import {
  listSupplierCertifications,
  resolveActiveSupplierIdByParam
} from '@/lib/suppliers';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id: idOrSlug } = await params;

  try {
    const resolved = await resolveActiveSupplierIdByParam(idOrSlug);
    if (!resolved) return notFound('Supplier not found');

    const rows = await listSupplierCertifications(resolved.id, {
      onlyApproved: true
    });

    const data = rows.map((c) => ({
      id: c.id,
      type: c.type,
      title: c.title,
      issuer: c.issuer,
      fileUrl: c.fileUrl,
      thumbUrl: c.thumbUrl,
      issuedAt: c.issuedAt,
      expiresAt: c.expiresAt,
      order: c.order,
      createdAt: c.createdAt
    }));

    return NextResponse.json({ data });
  } catch (error) {
    return handlePrismaError(
      error,
      `GET /api/suppliers/${idOrSlug}/certifications`
    );
  }
}
