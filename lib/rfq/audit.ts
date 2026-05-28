/**
 * Thin re-export shim. All RFQ-level audit writes now happen automatically
 * inside `transitionRfq()` in workflow.ts (same DB transaction as the
 * status change). This module is kept for quote-level audit entries and
 * for any callers that need a direct write outside of a workflow transition.
 */
import 'server-only';

import type { RfqQuoteStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/** Append a quote status change to the RfqAuditLog. */
export async function auditQuoteTransition(
  rfqId: string,
  quoteId: string,
  from: RfqQuoteStatus,
  to: RfqQuoteStatus,
  actorId: string
): Promise<void> {
  await prisma.rfqAuditLog.create({
    data: {
      rfqId,
      fromStatus: null,   // quote-level event; RFQ status unchanged
      toStatus: 'OPEN',   // placeholder — quote audit doesn't change RFQ status
      actorId,
      actorRole: 'system',
      trigger: `quote_${to.toLowerCase()}`,
      metadata: { quoteId, quoteFrom: from, quoteTo: to },
    },
  }).catch(() => { /* audit failure must never break the main flow */ });
}

