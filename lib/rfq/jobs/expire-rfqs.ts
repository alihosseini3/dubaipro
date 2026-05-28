/**
 * Cron job: expire RFQs whose deadline has passed.
 *
 * Run this via a scheduled task (pg_cron, BullMQ repeatable job, or
 * Vercel Cron at /api/cron/rfq-expiry).
 *
 * Idempotent: running multiple times on the same set is safe because
 * transitionRfq() will throw RfqWorkflowError for already-EXPIRED RFQs,
 * which we swallow here.
 */
import { prisma } from '@/lib/prisma';
import { transitionRfq, SYSTEM_ACTOR } from '../workflow';
import { EXPIRABLE_RFQ_STATUSES } from '../status-machine';

export async function expireOverdueRfqs(): Promise<{ expired: number; errors: number }> {
  const overdue = await prisma.rfqRequest.findMany({
    where: {
      status: { in: EXPIRABLE_RFQ_STATUSES },
      expiresAt: { lt: new Date() },
    },
    select: { id: true, status: true },
  });

  let expired = 0;
  let errors = 0;

  await Promise.allSettled(
    overdue.map(async ({ id }) => {
      try {
        await transitionRfq(id, 'EXPIRED', SYSTEM_ACTOR, 'cron_deadline');
        expired++;
      } catch {
        errors++;
      }
    })
  );

  return { expired, errors };
}

/**
 * Auto-close RFQs that have been FULFILLED for more than 7 days
 * without the buyer explicitly closing them.
 */
export async function autoCloseFulfilledRfqs(): Promise<{ closed: number; errors: number }> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const ready = await prisma.rfqRequest.findMany({
    where: { status: 'FULFILLED', updatedAt: { lt: cutoff } },
    select: { id: true },
  });

  let closed = 0;
  let errors = 0;

  await Promise.allSettled(
    ready.map(async ({ id }) => {
      try {
        await transitionRfq(id, 'CLOSED', SYSTEM_ACTOR, 'auto_close_post_fulfillment');
        closed++;
      } catch {
        errors++;
      }
    })
  );

  return { closed, errors };
}
