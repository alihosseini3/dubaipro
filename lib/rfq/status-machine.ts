/**
 * Single source of truth for all allowed state transitions in the RFQ domain.
 * NEVER write `prisma.rfqRequest.update({ data: { status } })` directly —
 * always use `transitionRfq()` from workflow.ts which enforces this graph.
 */
import type { RfqRequestStatus, RfqQuoteStatus } from '@prisma/client';

/* ─────────────────────────────────────────────────────────────────────────── */
/* RfqRequest state graph                                                       */
/* ─────────────────────────────────────────────────────────────────────────── */

const RFQ_GRAPH: Record<RfqRequestStatus, RfqRequestStatus[]> = {
  // Buyer creates → submits for review or directly publishes (trusted buyer)
  DRAFT:          ['PENDING_REVIEW', 'OPEN', 'CANCELLED'],
  // Awaiting admin approval; admin can approve, request changes, or reject
  PENDING_REVIEW: ['OPEN', 'DRAFT', 'CANCELLED'],
  // Live on marketplace — accepting quotes
  OPEN:           ['QUOTED', 'CANCELLED', 'EXPIRED'],
  // At least one quote; buyer can open negotiation thread or accept directly
  QUOTED:         ['NEGOTIATING', 'ACCEPTED', 'OPEN', 'CANCELLED', 'EXPIRED'],
  // Active back-and-forth on a specific quote thread
  NEGOTIATING:    ['ACCEPTED', 'QUOTED', 'CANCELLED', 'EXPIRED'],
  // Buyer formally accepted a quote → awaiting order fulfillment
  ACCEPTED:       ['FULFILLED', 'CANCELLED'],
  // Buyer confirmed receipt / order complete
  FULFILLED:      ['CLOSED'],
  // Terminal — no exit
  CLOSED:         [],
  // Buyer can re-open as a fresh draft
  CANCELLED:      ['DRAFT'],
  // Buyer can reactivate with a new deadline, or close
  EXPIRED:        ['OPEN', 'CLOSED'],
};

export function canTransitionRfq(
  from: RfqRequestStatus,
  to: RfqRequestStatus
): boolean {
  return RFQ_GRAPH[from]?.includes(to) ?? false;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* RfqQuote state graph                                                         */
/* ─────────────────────────────────────────────────────────────────────────── */

const QUOTE_GRAPH: Record<RfqQuoteStatus, RfqQuoteStatus[]> = {
  DRAFT:     ['SUBMITTED', 'WITHDRAWN'],
  SUBMITTED: ['ACCEPTED', 'REJECTED', 'WITHDRAWN'],
  ACCEPTED:  [],
  REJECTED:  [],
  WITHDRAWN: [],
};

export function canTransitionQuote(
  from: RfqQuoteStatus,
  to: RfqQuoteStatus
): boolean {
  return QUOTE_GRAPH[from]?.includes(to) ?? false;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Semantic status sets used in queries                                         */
/* ─────────────────────────────────────────────────────────────────────────── */

/** RFQ statuses where a supplier may still submit or update a quote. */
export const QUOTABLE_RFQ_STATUSES: RfqRequestStatus[] = [
  'OPEN', 'NEGOTIATING', 'QUOTED',
];

/** RFQ statuses visible on the public marketplace. */
export const PUBLIC_RFQ_STATUSES: RfqRequestStatus[] = [
  'OPEN', 'NEGOTIATING', 'QUOTED',
];

/** Terminal states — no further transitions possible. */
export const TERMINAL_RFQ_STATUSES: RfqRequestStatus[] = [
  'CLOSED', 'FULFILLED',
];

/** Statuses eligible for cron-based expiry. */
export const EXPIRABLE_RFQ_STATUSES: RfqRequestStatus[] = [
  'OPEN', 'QUOTED', 'NEGOTIATING',
];

/** Quote statuses that count toward the denormalized quoteCount. */
export const ACTIVE_QUOTE_STATUSES: RfqQuoteStatus[] = ['SUBMITTED', 'ACCEPTED'];
