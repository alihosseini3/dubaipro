import 'server-only';

import type { RfqVisibility } from '@prisma/client';

import { prisma } from '@/lib/prisma';

/**
 * Visibility gate for reading an RFQ. Mirrors `getRfqBySlug`:
 * a PRIVATE RFQ is only viewable by its owner or an admin.
 */
export function canViewRfq(
  rfq: { visibility: RfqVisibility; userId: string },
  viewerUserId: string | undefined,
  isAdmin: boolean
): boolean {
  if (isAdmin) return true;
  if (rfq.visibility === 'PRIVATE' && rfq.userId !== viewerUserId) return false;
  return true;
}

/**
 * Thread access for messaging/negotiation: the buyer (owner), an admin,
 * a supplier who has a (non-deleted) quote on this RFQ, or a supplier who
 * has been invited to the RFQ (pre-quote Q&A).
 */
export async function canAccessRfqThread(
  rfqId: string,
  userId: string,
  isAdmin = false
): Promise<boolean> {
  if (isAdmin) return true;

  const rfq = await prisma.rfqRequest.findUnique({
    where: { id: rfqId },
    select: { userId: true, visibility: true },
  });
  if (!rfq) return false;
  if (rfq.userId === userId) return true;

  const supplier = await prisma.supplier.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!supplier) return false;

  // Supplier has a quote (post-quote negotiation)
  const quote = await prisma.rfqQuote.findUnique({
    where: { rfqId_supplierId: { rfqId, supplierId: supplier.id } },
    select: { id: true },
  });
  if (quote) return true;

  // Supplier has been invited (pre-quote Q&A)
  const invite = await prisma.rfqSupplierInvite.findUnique({
    where: { rfqId_supplierId: { rfqId, supplierId: supplier.id } },
    select: { id: true },
  });
  if (invite) return true;

  // Public RFQs allow any verified supplier to ask questions
  if (rfq.visibility === 'PUBLIC') {
    return true;
  }

  return false;
}
