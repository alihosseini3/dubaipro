import 'server-only';

import { prisma } from '@/lib/prisma';
import {
  notifyMany,
  orgMemberIdsWithPermission
} from '@/lib/notifications/service';

/**
 * Supplier application review — the single atomic admin decision.
 *
 * Before this existed, "approval" was four independent toggles that set
 * `onboardingStatus` + `status` and nothing else: listing rights were never
 * granted, the SupplierVerification row stayed PENDING forever, no audit
 * trail was written, and the supplier was never told (a rejection reason was
 * collected by the UI and silently dropped).
 *
 * Both transitions here are one transaction over Supplier +
 * SupplierVerification + SupplierVerificationLog, mirroring the
 * `runTransition` pattern in ./verification.ts. Notifications fire
 * afterwards, fire-and-forget, so a mail hiccup can't roll back the decision.
 */

export class OnboardingError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'OnboardingError';
    this.status = status;
  }
}

const APPLICATION_SELECT = {
  id: true,
  name: true,
  onboardingStatus: true,
  status: true,
  canListProducts: true
} as const;

async function loadApplication(supplierId: string) {
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    select: { ...APPLICATION_SELECT, tier: true }
  });
  if (!supplier) throw new OnboardingError('Supplier not found', 404);
  return supplier;
}

/**
 * Approve the application: activates the account AND grants listing rights,
 * so the supplier can immediately submit products to the review queue.
 */
export async function approveApplication(params: {
  supplierId: string;
  adminId: string;
  note?: string | null;
}) {
  const before = await loadApplication(params.supplierId);

  const updated = await prisma.$transaction(async (tx) => {
    const supplier = await tx.supplier.update({
      where: { id: params.supplierId },
      data: {
        onboardingStatus: 'APPROVED',
        status: 'ACTIVE',
        canListProducts: true
      },
      select: APPLICATION_SELECT
    });

    // Resolve the open review request created at submit time.
    await tx.supplierVerification.updateMany({
      where: { supplierId: params.supplierId, status: 'PENDING' },
      data: {
        status: 'APPROVED',
        reviewerId: params.adminId,
        reviewedAt: new Date(),
        notes: params.note ?? null
      }
    });

    await tx.supplierVerificationLog.create({
      data: {
        supplierId: params.supplierId,
        actorId: params.adminId,
        action: 'APPROVE_APPLICATION',
        note: params.note ?? null,
        fromTier: before.tier,
        toTier: before.tier,
        fromStatus: before.status,
        toStatus: supplier.status
      }
    });

    return supplier;
  });

  void notifyOrg(params.supplierId, 'supplier.approved', {
    supplierName: updated.name
  });

  return updated;
}

/**
 * Reject the application. The reason is REQUIRED, persisted on the
 * SupplierVerification row, shown to the supplier in their dashboard, and
 * emailed to them in their preferred locale so they know what to fix.
 */
export async function rejectApplication(params: {
  supplierId: string;
  adminId: string;
  reason: string;
}) {
  const reason = params.reason.trim();
  if (reason.length < 3) {
    throw new OnboardingError('A rejection reason is required', 400);
  }

  const before = await loadApplication(params.supplierId);

  const updated = await prisma.$transaction(async (tx) => {
    const supplier = await tx.supplier.update({
      where: { id: params.supplierId },
      data: {
        onboardingStatus: 'REJECTED',
        // Revoke listing rights — a rejected application must not be able to
        // push products live, even if it was approved at some point before.
        canListProducts: false
      },
      select: APPLICATION_SELECT
    });

    await tx.supplierVerification.updateMany({
      where: { supplierId: params.supplierId, status: 'PENDING' },
      data: {
        status: 'REJECTED',
        reviewerId: params.adminId,
        reviewedAt: new Date(),
        notes: reason
      }
    });

    await tx.supplierVerificationLog.create({
      data: {
        supplierId: params.supplierId,
        actorId: params.adminId,
        action: 'REJECT_APPLICATION',
        note: reason,
        fromTier: before.tier,
        toTier: before.tier,
        fromStatus: before.status,
        toStatus: supplier.status
      }
    });

    return supplier;
  });

  void notifyOrg(params.supplierId, 'supplier.rejected', {
    supplierName: updated.name,
    reason
  });

  return updated;
}

/**
 * The latest review record — used to show the supplier WHY they were
 * rejected (SupplierVerification.notes) so they can fix and resubmit.
 */
export async function getLatestReview(supplierId: string) {
  return prisma.supplierVerification.findFirst({
    where: { supplierId },
    orderBy: { createdAt: 'desc' },
    select: { status: true, notes: true, reviewedAt: true }
  });
}

async function notifyOrg(
  supplierId: string,
  templateKey: 'supplier.approved' | 'supplier.rejected',
  params: Record<string, string>
) {
  try {
    const userIds = await orgMemberIdsWithPermission(
      supplierId,
      'supplier.profile.manage'
    );
    await notifyMany(userIds, templateKey, params, { link: '/supplier' });
  } catch {
    /* notification failure must never affect the admin decision */
  }
}
