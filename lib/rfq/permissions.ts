import type { RfqRequestStatus } from '@prisma/client';

export type ActorRole = 'buyer' | 'supplier' | 'admin' | 'system';

export interface TransitionActor {
  id: string;
  role: ActorRole;
  flags?: string[];
}

interface PermissionRule {
  /** Roles allowed to perform this transition */
  roles: ActorRole[];
  /** If true, the actor must be the RFQ owner (userId) */
  ownerRequired?: boolean;
  /** Feature flag required (e.g. 'TRUSTED_BUYER') */
  requiredFlag?: string;
}

/** Explicit permission for every valid RFQ transition. */
export const TRANSITION_PERMISSIONS: Partial<
  Record<`${RfqRequestStatus}->${RfqRequestStatus}`, PermissionRule>
> = {
  'DRAFT->PENDING_REVIEW': { roles: ['buyer'], ownerRequired: true },
  'DRAFT->OPEN':           { roles: ['buyer', 'admin'], ownerRequired: true, requiredFlag: 'TRUSTED_BUYER' },
  'DRAFT->CANCELLED':      { roles: ['buyer'], ownerRequired: true },

  'PENDING_REVIEW->OPEN':       { roles: ['admin', 'system'] },
  'PENDING_REVIEW->DRAFT':      { roles: ['admin'] },
  'PENDING_REVIEW->CANCELLED':  { roles: ['admin'] },

  'OPEN->QUOTED':     { roles: ['system'] },
  'OPEN->CANCELLED':  { roles: ['buyer', 'admin'], ownerRequired: true },
  'OPEN->EXPIRED':    { roles: ['system'] },

  'QUOTED->NEGOTIATING': { roles: ['buyer'], ownerRequired: true },
  'QUOTED->ACCEPTED':    { roles: ['buyer'], ownerRequired: true },
  'QUOTED->OPEN':        { roles: ['system'] },  // all quotes withdrawn
  'QUOTED->CANCELLED':   { roles: ['buyer', 'admin'], ownerRequired: true },
  'QUOTED->EXPIRED':     { roles: ['system'] },

  'NEGOTIATING->ACCEPTED': { roles: ['buyer'], ownerRequired: true },
  'NEGOTIATING->QUOTED':   { roles: ['buyer', 'system'], ownerRequired: false },
  'NEGOTIATING->CANCELLED':{ roles: ['buyer', 'admin'], ownerRequired: true },
  'NEGOTIATING->EXPIRED':  { roles: ['system'] },

  'ACCEPTED->FULFILLED':  { roles: ['buyer'], ownerRequired: true },
  'ACCEPTED->CANCELLED':  { roles: ['admin'] },  // exceptional only

  'FULFILLED->CLOSED': { roles: ['system', 'buyer', 'admin'] },

  'EXPIRED->OPEN':   { roles: ['buyer'], ownerRequired: true },
  'EXPIRED->CLOSED': { roles: ['buyer', 'admin', 'system'], ownerRequired: false },

  'CANCELLED->DRAFT': { roles: ['buyer'], ownerRequired: true },
};

export class RfqPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RfqPermissionError';
  }
}

export function assertTransitionPermission(
  from: RfqRequestStatus,
  to: RfqRequestStatus,
  actor: TransitionActor,
  rfqOwnerId: string
): void {
  if (actor.role === 'system') return; // system bypasses permission check

  const key = `${from}->${to}` as `${RfqRequestStatus}->${RfqRequestStatus}`;
  const rule = TRANSITION_PERMISSIONS[key];

  if (!rule) {
    throw new RfqPermissionError(`No permission rule defined for ${key}`);
  }
  if (!rule.roles.includes(actor.role)) {
    throw new RfqPermissionError(
      `Role '${actor.role}' is not allowed to perform ${key}`
    );
  }
  if (rule.ownerRequired && actor.id !== rfqOwnerId) {
    throw new RfqPermissionError(
      `Actor '${actor.id}' does not own this RFQ`
    );
  }
  if (rule.requiredFlag && !actor.flags?.includes(rule.requiredFlag)) {
    throw new RfqPermissionError(
      `Transition ${key} requires flag '${rule.requiredFlag}'`
    );
  }
}
