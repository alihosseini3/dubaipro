import 'server-only';

import { type Prisma, type SupplierStatus, type SupplierTier } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import { type VerificationAction } from './types';

/**
 * Verification workflow service.
 *
 * Owns every transition of `Supplier.tier` / `Supplier.status` together
 * with a corresponding append-only `SupplierVerificationLog` row.
 *
 * Invariants:
 *   - Tier/status transitions and log writes are atomic (single transaction).
 *   - `Supplier.verified` (legacy boolean) stays in sync with `tier`:
 *     true when tier ∈ {VERIFIED, GUARANTEED}, false otherwise.
 *   - `verifiedAt` is set the moment the tier moves out of STANDARD; cleared
 *     when it returns to STANDARD or when the supplier is rejected.
 *   - All transitions accept an `actorId` (admin user id) which is stored
 *     in the log as a plain string (no FK) — see schema rationale.
 */

export type TransitionInput = {
  supplierId: string;
  actorId: string;
  note?: string | null;
};

export async function approveTier(
  input: TransitionInput & { toTier: SupplierTier; expiresAt?: Date | null }
) {
  return runTransition(input.supplierId, input.actorId, 'APPROVE_TIER', input.note ?? null, {
    tier: input.toTier,
    status: 'ACTIVE',
    verified: input.toTier !== 'STANDARD',
    verifiedAt: input.toTier !== 'STANDARD' ? new Date() : null,
    verifiedById: input.toTier !== 'STANDARD' ? input.actorId : null,
    verificationExpiresAt: input.expiresAt ?? null
  });
}

export async function rejectSupplier(input: TransitionInput) {
  return runTransition(input.supplierId, input.actorId, 'REJECT', input.note ?? null, {
    status: 'PENDING_REVIEW',
    tier: 'STANDARD',
    verified: false,
    verifiedAt: null,
    verifiedById: null,
    verificationExpiresAt: null
  });
}

export async function suspendSupplier(input: TransitionInput) {
  return runTransition(input.supplierId, input.actorId, 'SUSPEND', input.note ?? null, {
    status: 'SUSPENDED'
  });
}

export async function restoreSupplier(input: TransitionInput) {
  return runTransition(input.supplierId, input.actorId, 'RESTORE', input.note ?? null, {
    status: 'ACTIVE'
  });
}

export async function blacklistSupplier(input: TransitionInput) {
  return runTransition(input.supplierId, input.actorId, 'BLACKLIST', input.note ?? null, {
    status: 'BLACKLISTED'
  });
}

export async function setFeatured(
  input: TransitionInput & { isFeatured: boolean }
) {
  return runTransition(
    input.supplierId,
    input.actorId,
    input.isFeatured ? 'FEATURE' : 'UNFEATURE',
    input.note ?? null,
    { isFeatured: input.isFeatured }
  );
}

/** Free-form note appended to the verification log without state change. */
export async function addVerificationNote(
  input: TransitionInput & { note: string }
) {
  return runTransition(input.supplierId, input.actorId, 'NOTE', input.note, {});
}

/**
 * Recurring job target: mark verifications whose `verificationExpiresAt`
 * is in the past as STANDARD + log an EXPIRE entry. Idempotent.
 */
export async function expireOverdueVerifications(now: Date = new Date()) {
  const due = await prisma.supplier.findMany({
    where: {
      verificationExpiresAt: { lt: now },
      tier: { not: 'STANDARD' }
    },
    select: { id: true, tier: true, status: true }
  });

  for (const row of due) {
    await prisma.$transaction(async (tx) => {
      await tx.supplier.update({
        where: { id: row.id },
        data: {
          tier: 'STANDARD',
          verified: false,
          verifiedAt: null,
          verifiedById: null,
          verificationExpiresAt: null
        }
      });
      await tx.supplierVerificationLog.create({
        data: {
          supplierId: row.id,
          action: 'EXPIRE',
          fromTier: row.tier,
          toTier: 'STANDARD',
          fromStatus: row.status,
          toStatus: row.status
        }
      });
    });
  }

  return due.length;
}

/** Returns the full timeline for an admin detail page. */
export async function listVerificationLog(supplierId: string) {
  return prisma.supplierVerificationLog.findMany({
    where: { supplierId },
    orderBy: { createdAt: 'desc' }
  });
}

// ─── Internals ────────────────────────────────────────────────────────────

/**
 * Apply a partial Supplier update + write a log row in one transaction.
 * `data` is intentionally typed loosely (Prisma update input) so each
 * caller can decide which subset of fields to touch — the helper records
 * the before/after `tier` & `status` so the log is always complete.
 */
async function runTransition(
  supplierId: string,
  actorId: string,
  action: VerificationAction,
  note: string | null,
  data: Prisma.SupplierUpdateInput
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.supplier.findUnique({
      where: { id: supplierId },
      select: { tier: true, status: true }
    });
    if (!before) {
      throw new Error(`Supplier ${supplierId} not found`);
    }

    const updated = await tx.supplier.update({
      where: { id: supplierId },
      data
    });

    await tx.supplierVerificationLog.create({
      data: {
        supplierId,
        actorId,
        action,
        note,
        fromTier: before.tier,
        toTier: updated.tier,
        fromStatus: before.status,
        toStatus: updated.status
      }
    });

    return updated;
  });
}
