/**
 * POST /api/admin/suppliers/[id]/tier
 *
 * Admin verification decision — goes through lib/suppliers/verification.ts
 * so `tier`, `verified`, `verifiedAt`/`verifiedById`, and the append-only
 * SupplierVerificationLog all move together atomically. Replaces the old
 * raw `verified` boolean toggle, which never touched `tier` and left it
 * stuck at STANDARD forever.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { SupplierTier } from '@prisma/client';

import { createRoute } from '@/lib/api/handler';
import { approveTier, rejectSupplier } from '@/lib/suppliers/verification';

export const runtime = 'nodejs';

const bodySchema = z
  .object({
    action: z.enum(['approve', 'reject']),
    tier: z.enum(['STANDARD', 'VERIFIED', 'GUARANTEED']).optional(),
    note: z.string().trim().max(1000).optional(),
    /** Optional expiry for the granted tier (e.g. license/cert expiry). */
    expiresAt: z.string().datetime().optional()
  })
  .refine((v) => v.action !== 'approve' || v.tier !== undefined, {
    message: 'tier is required to approve',
    path: ['tier']
  });

export const POST = createRoute(
  {
    auth: 'admin',
    permission: 'suppliers.manage',
    body: bodySchema,
    audit: { action: 'supplier.tier.review', entityType: 'Supplier' }
  },
  async ({ user, params, body, audit }) => {
    const supplierId = String(params.id);
    const updated =
      body.action === 'approve'
        ? await approveTier({
            supplierId,
            actorId: user.id,
            toTier: body.tier as SupplierTier,
            note: body.note ?? null,
            expiresAt: body.expiresAt ? new Date(body.expiresAt) : null
          })
        : await rejectSupplier({
            supplierId,
            actorId: user.id,
            note: body.note ?? null
          });

    audit.entityId = supplierId;
    audit.supplierId = supplierId;
    audit.diff = { after: { tier: updated.tier, status: updated.status } };
    return NextResponse.json({ data: updated });
  }
);
