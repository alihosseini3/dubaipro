/**
 * Central workflow engine for RFQ state transitions.
 *
 * This is the ONLY place allowed to change rfqRequest.status.
 * Every transition is:
 *   1. Validated against the state machine graph
 *   2. Permission-checked against the actor's role
 *   3. Written atomically with an audit log entry AND an outbox event
 *      — all in a single DB transaction, so no transition is ever lost.
 */
import 'server-only';

import type { RfqRequestStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { canTransitionRfq } from './status-machine';
import {
  assertTransitionPermission,
  type TransitionActor,
  RfqPermissionError,
} from './permissions';

export { RfqPermissionError };
export type { TransitionActor };

export class RfqWorkflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RfqWorkflowError';
  }
}

export const SYSTEM_ACTOR: TransitionActor = { id: 'system', role: 'system' };

interface TransitionOptions {
  reason?: string;
  metadata?: Record<string, unknown>;
}

function toEventType(from: RfqRequestStatus, to: RfqRequestStatus): string {
  const map: Partial<Record<`${RfqRequestStatus}->${RfqRequestStatus}`, string>> = {
    'DRAFT->OPEN':            'RfqPublished',
    'DRAFT->PENDING_REVIEW':  'RfqSubmitted',
    'PENDING_REVIEW->OPEN':   'RfqPublished',
    'OPEN->QUOTED':           'RfqFirstQuoteReceived',
    'QUOTED->NEGOTIATING':    'RfqNegotiationStarted',
    'QUOTED->OPEN':           'RfqAllQuotesWithdrawn',
    'NEGOTIATING->ACCEPTED':  'RfqQuoteAccepted',
    'QUOTED->ACCEPTED':       'RfqQuoteAccepted',
    'NEGOTIATING->QUOTED':    'RfqNegotiationAbandoned',
    'OPEN->EXPIRED':          'RfqExpired',
    'QUOTED->EXPIRED':        'RfqExpired',
    'NEGOTIATING->EXPIRED':   'RfqExpired',
    'OPEN->CANCELLED':        'RfqCancelled',
    'QUOTED->CANCELLED':      'RfqCancelled',
    'NEGOTIATING->CANCELLED': 'RfqCancelled',
    'ACCEPTED->CANCELLED':    'RfqCancelled',
    'ACCEPTED->FULFILLED':    'RfqFulfilled',
    'FULFILLED->CLOSED':      'RfqClosed',
    'EXPIRED->OPEN':          'RfqReactivated',
    'EXPIRED->CLOSED':        'RfqClosed',
    'CANCELLED->DRAFT':       'RfqReopenedAsDraft',
  };
  return map[`${from}->${to}` as keyof typeof map] ?? `RfqTransition_${from}_${to}`;
}

/**
 * Atomically transitions an RFQ to a new status.
 *
 * Throws `RfqWorkflowError` for invalid state-machine transitions.
 * Throws `RfqPermissionError` for unauthorized actors.
 */
export async function transitionRfq(
  rfqId: string,
  to: RfqRequestStatus,
  actor: TransitionActor,
  trigger: string,
  opts?: TransitionOptions
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const rfq = await tx.rfqRequest.findUnique({
      where: { id: rfqId },
      select: { id: true, status: true, userId: true },
    });

    if (!rfq) throw new RfqWorkflowError(`RFQ ${rfqId} not found`);

    // 1. State-machine guard
    if (!canTransitionRfq(rfq.status, to)) {
      throw new RfqWorkflowError(
        `Invalid transition ${rfq.status} → ${to} for RFQ ${rfqId}`
      );
    }

    // 2. Permission guard
    assertTransitionPermission(rfq.status, to, actor, rfq.userId);

    // 3. Apply transition
    await tx.rfqRequest.update({ where: { id: rfqId }, data: { status: to } });

    // 4. Immutable audit entry (same transaction — never lost)
    await tx.rfqAuditLog.create({
      data: {
        rfqId,
        fromStatus: rfq.status,
        toStatus: to,
        actorId: actor.id,
        actorRole: actor.role,
        trigger,
        reason: opts?.reason ?? null,
        metadata: opts?.metadata as Prisma.InputJsonValue | undefined,
      },
    });

    // 5. Outbox event (delivered asynchronously — never blocks response)
    await tx.rfqEventOutbox.create({
      data: {
        rfqId,
        eventType: toEventType(rfq.status, to),
        payload: {
          rfqId,
          from: rfq.status,
          to,
          actorId: actor.id,
          trigger,
          metadata: (opts?.metadata ?? null) as Prisma.InputJsonValue,
        } as Prisma.InputJsonValue,
      },
    });
  });
}

/**
 * Retrieve the full audit trail for an RFQ, oldest-first.
 */
export async function getRfqAuditLog(rfqId: string) {
  return prisma.rfqAuditLog.findMany({
    where: { rfqId },
    orderBy: { createdAt: 'asc' },
  });
}
