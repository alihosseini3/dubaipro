import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createRoute } from '@/lib/api/handler';
import { prisma } from '@/lib/prisma';
import { approveCertification, rejectCertification } from '@/lib/suppliers/certifications';

export const runtime = 'nodejs';

const bodySchema = z
  .object({
    action: z.enum(['approve', 'reject']),
    note: z.string().trim().max(1000).optional()
  })
  .refine((v) => v.action !== 'reject' || (v.note && v.note.length >= 3), {
    message: 'A rejection note is required',
    path: ['note']
  });

/** POST /api/admin/suppliers/[id]/certifications/[certId]/review */
export const POST = createRoute(
  {
    auth: 'admin',
    permission: 'suppliers.manage',
    body: bodySchema,
    audit: { action: 'supplier.certification.review', entityType: 'SupplierCertification' }
  },
  async ({ user, params, body, audit }) => {
    const supplierId = String(params.id);
    const certId = String(params.certId);

    const cert = await prisma.supplierCertification.findUnique({
      where: { id: certId },
      select: { id: true, supplierId: true }
    });
    if (!cert || cert.supplierId !== supplierId) {
      return NextResponse.json({ error: 'Certification not found' }, { status: 404 });
    }

    const updated =
      body.action === 'approve'
        ? await approveCertification(certId, user.id, body.note ?? null)
        : await rejectCertification(certId, user.id, body.note as string);

    audit.entityId = certId;
    audit.supplierId = supplierId;
    audit.diff = { after: { status: updated.status } };
    return NextResponse.json({ data: updated });
  }
);
