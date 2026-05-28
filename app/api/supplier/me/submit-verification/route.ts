/**
 * POST /api/supplier/me/submit-verification
 *
 * The authenticated supplier flips their own row to PENDING_REVIEW
 * and writes a SUBMIT_DOCS log entry so an admin can pick it up from
 * the verification queue. Idempotent — repeated calls just append a
 * new log entry (useful when the supplier resubmits with new docs).
 */
import { NextResponse } from 'next/server';

import { handlePrismaError } from '@/lib/api/errors';
import { getSupplierContextOrNull } from '@/lib/auth/require-supplier';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST() {
  const ctx = await getSupplierContextOrNull();
  if (!ctx) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.supplier.findUnique({
        where: { id: ctx.supplier.id },
        select: { tier: true, status: true }
      });
      if (!before) throw new Error('supplier not found');

      const updated = await tx.supplier.update({
        where: { id: ctx.supplier.id },
        data: { status: 'PENDING_REVIEW' }
      });

      await tx.supplierVerificationLog.create({
        data: {
          supplierId: ctx.supplier.id,
          action: 'SUBMIT_DOCS',
          actorId: ctx.user.id,
          fromTier: before.tier,
          toTier: updated.tier,
          fromStatus: before.status,
          toStatus: updated.status
        }
      });

      return updated;
    });

    return NextResponse.json({
      data: { status: result.status, tier: result.tier }
    });
  } catch (error) {
    return handlePrismaError(error, 'POST /api/supplier/me/submit-verification');
  }
}
