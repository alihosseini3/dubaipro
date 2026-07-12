import type { SupplierOnboardingStatus, SupplierStatus } from '@prisma/client';

/**
 * Supplier listing gate — the single source of truth for "may this supplier
 * put products in front of buyers?".
 *
 * Pure (no I/O) so it is unit-testable and can be evaluated both server-side
 * (the real enforcement, in lib/products/service.ts) and in the UI to decide
 * which banner/button state to render.
 *
 * Two levels, per the approved product decision:
 *   - DRAFT products: allowed for any supplier that isn't suspended/blacklisted,
 *     so a pending applicant can prepare their catalog while they wait.
 *   - SUBMIT for review: requires a completed admin approval. This is what
 *     "after the admin approves, the supplier can list products" means.
 */

export type GateReason =
  /** Application never submitted (still a DRAFT registration). */
  | 'not_submitted'
  /** Submitted, waiting on the admin decision. */
  | 'pending_review'
  /** Admin rejected the application — the reason is on SupplierVerification.notes. */
  | 'rejected'
  /** Approved once, but listing rights were revoked by an admin. */
  | 'not_granted'
  | 'suspended'
  | 'blacklisted';

export type Gate = { allowed: true } | { allowed: false; reason: GateReason };

const ALLOWED: Gate = { allowed: true };

/** Blocked for suspended/blacklisted accounts regardless of onboarding state. */
function accountBlock(status: SupplierStatus): Gate | null {
  if (status === 'SUSPENDED') return { allowed: false, reason: 'suspended' };
  if (status === 'BLACKLISTED') return { allowed: false, reason: 'blacklisted' };
  return null;
}

/** Creating/editing DRAFT products — open while the application is pending. */
export function canDraftProducts(supplier: { status: SupplierStatus }): Gate {
  return accountBlock(supplier.status) ?? ALLOWED;
}

/**
 * Submitting a product to the admin review queue (i.e. actually trying to go
 * live). Requires: approved application + active account + listing rights.
 */
export function canSubmitProducts(supplier: {
  onboardingStatus: SupplierOnboardingStatus;
  status: SupplierStatus;
  canListProducts: boolean;
}): Gate {
  const blocked = accountBlock(supplier.status);
  if (blocked) return blocked;

  switch (supplier.onboardingStatus) {
    case 'DRAFT':
      return { allowed: false, reason: 'not_submitted' };
    case 'PENDING':
      return { allowed: false, reason: 'pending_review' };
    case 'REJECTED':
      return { allowed: false, reason: 'rejected' };
    case 'APPROVED':
      break;
  }

  // Approved, but an admin can still revoke listing rights without a full
  // suspension (e.g. a compliance hold).
  if (!supplier.canListProducts) {
    return { allowed: false, reason: 'not_granted' };
  }
  if (supplier.status !== 'ACTIVE') {
    return { allowed: false, reason: 'pending_review' };
  }
  return ALLOWED;
}
