/**
 * RFQ outbox relay.
 *
 * Drains the transactional `rfqEventOutbox` table written by
 * `transitionRfq()` and delivers the resulting domain notifications.
 *
 * Reliability guarantees:
 *   - States: PENDING → DELIVERED, or PENDING → FAILED (retried until
 *     MAX_ATTEMPTS, then parked as a dead letter).
 *   - `attempts` is incremented on every processing pass.
 *   - Errors are persisted on the row (`lastError`) and logged.
 *   - Idempotent: every outbound notification uses a dedupeKey derived
 *     from the immutable outbox row id, so re-processing a row (after a
 *     transient failure or duplicate cron tick) never double-sends.
 *
 * Run via the /api/cron/rfq-outbox endpoint on a short schedule.
 */
import 'server-only';

import { AutomationEventType, OutboxStatus, Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { dispatchAutomation } from '@/lib/automation/dispatch';

const MAX_ATTEMPTS = 5;
const DEFAULT_BATCH = 50;

export interface RelayResult {
  processed: number;
  delivered: number;
  failed: number;
  deadLettered: number;
}

/** Context loaded once per RFQ and shared with handlers. */
interface OutboxContext {
  rfqId: string;
  buyerUserId: string;
  buyerEmail: string | null;
  buyerName: string | null;
  title: string;
  slug: string;
}

type OutboxEventRow = {
  id: string;
  rfqId: string;
  eventType: string;
  payload: Prisma.JsonValue;
  status: OutboxStatus;
  attempts: number;
};

/**
 * Handler registry: maps the workflow event name (see `toEventType` in
 * workflow.ts) to a side-effecting deliverer. Events with no handler are
 * treated as successful no-ops so the table never bloats with rows that
 * have no consumer.
 *
 * `dedupeKey` is always `rfq-outbox:<eventId>` so retries are idempotent.
 */
const HANDLERS: Record<
  string,
  (ctx: OutboxContext, dedupeKey: string) => Promise<void>
> = {
  // Buyer's RFQ went live on the marketplace.
  RfqPublished: async (ctx, dedupeKey) => {
    if (!ctx.buyerEmail) return;
    await dispatchAutomation({
      eventType: AutomationEventType.RFQ_REQUEST_CREATED,
      userId: ctx.buyerUserId,
      email: ctx.buyerEmail,
      dedupeKey,
      vars: {
        name: ctx.buyerName ?? '',
        product: ctx.title,
        link: `/rfq/${ctx.slug}`,
        price: '',
      },
    });
  },

  // Buyer's RFQ expired without a closed deal.
  RfqExpired: async (ctx, dedupeKey) => {
    if (!ctx.buyerEmail) return;
    await dispatchAutomation({
      eventType: AutomationEventType.RFQ_EXPIRING,
      userId: ctx.buyerUserId,
      email: ctx.buyerEmail,
      dedupeKey,
      vars: {
        name: ctx.buyerName ?? '',
        product: ctx.title,
        link: `/rfq/${ctx.slug}`,
        price: '',
      },
    });
  },
};

/**
 * Process a batch of outbox rows. Safe to call repeatedly (cron).
 */
export async function relayOutboxEvents(batchSize = DEFAULT_BATCH): Promise<RelayResult> {
  const rows: OutboxEventRow[] = await prisma.rfqEventOutbox.findMany({
    where: {
      OR: [
        { status: OutboxStatus.PENDING },
        { status: OutboxStatus.FAILED, attempts: { lt: MAX_ATTEMPTS } },
      ],
    },
    orderBy: { createdAt: 'asc' },
    take: batchSize,
    select: {
      id: true,
      rfqId: true,
      eventType: true,
      payload: true,
      status: true,
      attempts: true,
    },
  });

  const result: RelayResult = { processed: 0, delivered: 0, failed: 0, deadLettered: 0 };
  if (rows.length === 0) return result;

  // Load buyer context for the RFQs in this batch (one query).
  const rfqIds = [...new Set(rows.map((r) => r.rfqId))];
  const rfqs = await prisma.rfqRequest.findMany({
    where: { id: { in: rfqIds } },
    select: {
      id: true,
      userId: true,
      title: true,
      slug: true,
      user: { select: { email: true, name: true } },
    },
  });
  const ctxById = new Map<string, OutboxContext>(
    rfqs.map((r) => [
      r.id,
      {
        rfqId: r.id,
        buyerUserId: r.userId,
        buyerEmail: r.user?.email ?? null,
        buyerName: r.user?.name ?? null,
        title: r.title,
        slug: r.slug,
      },
    ])
  );

  for (const row of rows) {
    result.processed++;
    const dedupeKey = `rfq-outbox:${row.id}`;
    try {
      const ctx = ctxById.get(row.rfqId);
      const handler = HANDLERS[row.eventType];
      // No handler, or RFQ context missing (e.g. deleted) → deliver as no-op.
      if (handler && ctx) {
        await handler(ctx, dedupeKey);
      }
      await prisma.rfqEventOutbox.update({
        where: { id: row.id },
        data: {
          status: OutboxStatus.DELIVERED,
          attempts: { increment: 1 },
          deliveredAt: new Date(),
          lastError: null,
        },
      });
      result.delivered++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const willDeadLetter = row.attempts + 1 >= MAX_ATTEMPTS;
      await prisma.rfqEventOutbox
        .update({
          where: { id: row.id },
          data: {
            status: OutboxStatus.FAILED,
            attempts: { increment: 1 },
            lastError: message.slice(0, 1000),
          },
        })
        .catch(() => null);
      result.failed++;
      if (willDeadLetter) result.deadLettered++;
      // eslint-disable-next-line no-console
      console.error(
        `[rfq-outbox] delivery failed for ${row.id} (${row.eventType}), attempt ${row.attempts + 1}/${MAX_ATTEMPTS}: ${message}`
      );
    }
  }

  return result;
}
