import { ProductStatus } from '@prisma/client';

/**
 * Pure product-status transition matrix. Kept I/O-free so it is unit-testable
 * and shareable between the service, the UI (button visibility), and tests.
 *
 *   DRAFT ──submit──▶ PENDING_REVIEW ──approve──▶ APPROVED
 *     ▲                    │  ▲                       │
 *     │                  reject │ submit              │
 *  unarchive               ▼  │                     │
 *  (ARCHIVED)           REJECTED ◀──────────────────┘ (reject: admin pulls a live product)
 *     ▲                                              │
 *     └───────────── archive (any non-archived) ◀────┘
 */

export type ProductAction =
  | 'submit' // supplier: DRAFT | REJECTED → PENDING_REVIEW
  | 'approve' // admin:   PENDING_REVIEW → APPROVED
  | 'reject' // admin:   PENDING_REVIEW | APPROVED → REJECTED (reason required)
  | 'archive' // supplier/admin: any non-archived → ARCHIVED
  | 'unarchive'; // supplier: ARCHIVED → DRAFT

export type ActorKind = 'supplier' | 'admin';

const TRANSITIONS: Record<
  ProductAction,
  { from: readonly ProductStatus[]; to: ProductStatus; actor: readonly ActorKind[] }
> = {
  submit: {
    from: [ProductStatus.DRAFT, ProductStatus.REJECTED],
    to: ProductStatus.PENDING_REVIEW,
    actor: ['supplier']
  },
  approve: {
    from: [ProductStatus.PENDING_REVIEW],
    to: ProductStatus.APPROVED,
    actor: ['admin']
  },
  reject: {
    from: [ProductStatus.PENDING_REVIEW, ProductStatus.APPROVED],
    to: ProductStatus.REJECTED,
    actor: ['admin']
  },
  archive: {
    from: [
      ProductStatus.DRAFT,
      ProductStatus.PENDING_REVIEW,
      ProductStatus.APPROVED,
      ProductStatus.REJECTED
    ],
    to: ProductStatus.ARCHIVED,
    actor: ['supplier', 'admin']
  },
  unarchive: {
    from: [ProductStatus.ARCHIVED],
    to: ProductStatus.DRAFT,
    actor: ['supplier']
  }
};

export type TransitionCheck =
  | { ok: true; to: ProductStatus }
  | { ok: false; reason: 'invalid_from' | 'forbidden_actor' };

export function checkTransition(
  action: ProductAction,
  from: ProductStatus,
  actor: ActorKind
): TransitionCheck {
  const rule = TRANSITIONS[action];
  if (!rule.actor.includes(actor)) return { ok: false, reason: 'forbidden_actor' };
  if (!rule.from.includes(from)) return { ok: false, reason: 'invalid_from' };
  return { ok: true, to: rule.to };
}

/** Actions the given actor may take from the given status (for UI buttons). */
export function availableActions(
  from: ProductStatus,
  actor: ActorKind
): ProductAction[] {
  return (Object.keys(TRANSITIONS) as ProductAction[]).filter(
    (action) => checkTransition(action, from, actor).ok
  );
}
