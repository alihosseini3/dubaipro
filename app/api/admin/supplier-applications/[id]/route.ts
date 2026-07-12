import { NextResponse } from 'next/server';
import { z } from 'zod';
import { SupplierStatus } from '@prisma/client';

import { createRoute } from '@/lib/api/handler';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const bodySchema = z.object({
  accountStatus: z.enum(SupplierStatus)
});

/**
 * PATCH /api/admin/supplier-applications/[id] — account status only
 * (suspend / restore / blacklist).
 *
 * The application decision itself (approve/reject, which grants or revokes
 * product-listing rights) lives in ./review — it must stay atomic, so this
 * route deliberately no longer accepts `onboardingStatus`, `verified`, or
 * `canListProducts`. Writing those directly here would let an admin flip the
 * listing gate without the transaction, verification record, audit trail, and
 * supplier notification that the review route guarantees.
 */
export const PATCH = createRoute(
  {
    auth: 'admin',
    permission: 'suppliers.manage',
    body: bodySchema,
    audit: { action: 'supplier.account.status', entityType: 'Supplier' }
  },
  async ({ params, body, audit }) => {
    const id = String(params.id);
    try {
      const supplier = await prisma.supplier.update({
        where: { id },
        data: { status: body.accountStatus },
        select: {
          id: true,
          onboardingStatus: true,
          status: true,
          verified: true,
          canListProducts: true
        }
      });
      audit.entityId = id;
      audit.supplierId = id;
      audit.diff = { after: { status: supplier.status } };
      return NextResponse.json({ data: supplier });
    } catch {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }
  }
);
