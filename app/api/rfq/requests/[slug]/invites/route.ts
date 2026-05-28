import { NextResponse } from 'next/server';

import { badRequest, handlePrismaError, notFound } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';
import { getCurrentUser } from '@/lib/auth/session';
import { inviteSupplier } from '@/lib/rfq/service';
import { getRfqBySlug } from '@/lib/rfq/service';
import { dispatchAutomation } from '@/lib/automation/dispatch';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = await parseJsonBody<{ supplierId: string }>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const { supplierId } = parsed.data;
  if (!supplierId) return badRequest('supplierId is required');

  try {
    const rfq = await getRfqBySlug(slug, user.id, user.role === 'ADMIN');
    if (!rfq) return notFound('RFQ not found');

    const ok = await inviteSupplier(rfq.id, supplierId, user.id, user.role === 'ADMIN');
    if (!ok) return badRequest('invite_failed');

    // Notify supplier (best-effort)
    const supplierRow = await prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { user: { select: { email: true, name: true } } },
    });
    if (supplierRow?.user?.email) {
      dispatchAutomation({
        eventType: 'RFQ_SUPPLIER_INVITED',
        userId: null,
        email: supplierRow.user.email,
        dedupeKey: `RFQ_SUPPLIER_INVITED:${rfq.id}:${supplierId}`,
        vars: {
          name: supplierRow.user.name,
          product: rfq.title,
          link: `/supplier/rfq`,
          price: '',
        },
      }).catch(() => null);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handlePrismaError(error, `POST /api/rfq/requests/${slug}/invites`);
  }
}
