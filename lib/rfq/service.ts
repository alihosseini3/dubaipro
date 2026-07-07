import 'server-only';

import type { RfqRequestStatus, RfqVisibility, Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { dispatchAutomation } from '@/lib/automation/dispatch';

import { generateUniqueRfqSlug } from './slug';
import { transitionRfq, SYSTEM_ACTOR, type TransitionActor } from './workflow';
import { rfqRequiresModeration } from './config';
import { QUOTE_SELECT, QuoteRow, mapQuote } from './_quote-helpers';
import type {
  CreateRfqInput,
  UpdateRfqInput,
  RfqRequestCard,
  RfqRequestDetail,
  RfqListFilters,
} from './types';

/* ─────────────────────────────────────────────────────────────────────────── */
/* Selects                                                                      */
/* ─────────────────────────────────────────────────────────────────────────── */

const CARD_SELECT = {
  id: true,
  slug: true,
  userId: true,
  title: true,
  quantity: true,
  unit: true,
  targetPrice: true,
  currency: true,
  shippingCountry: true,
  urgency: true,
  status: true,
  quoteCount: true,
  viewCount: true,
  expiresAt: true,
  createdAt: true,
  user: { select: { name: true } },
  category: { select: { name: true } },
} as const;

/* ─────────────────────────────────────────────────────────────────────────── */
/* Mappers                                                                      */
/* ─────────────────────────────────────────────────────────────────────────── */

type CardRow = Prisma.RfqRequestGetPayload<{ select: typeof CARD_SELECT }>;

function mapCard(r: CardRow): RfqRequestCard {
  return {
    id: r.id,
    slug: r.slug,
    userId: r.userId,
    title: r.title,
    quantity: r.quantity,
    unit: r.unit,
    targetPrice: r.targetPrice ? Number(r.targetPrice) : null,
    currency: r.currency,
    shippingCountry: r.shippingCountry,
    urgency: r.urgency,
    status: r.status,
    quoteCount: r.quoteCount,
    viewCount: r.viewCount,
    expiresAt: r.expiresAt,
    createdAt: r.createdAt,
    buyerName: r.user.name,
    categoryName: r.category?.name ?? null,
  };
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Queries                                                                      */
/* ─────────────────────────────────────────────────────────────────────────── */

export async function listRfqs(
  filters: RfqListFilters,
  viewerUserId?: string,
  isAdmin = false
): Promise<{ items: RfqRequestCard[]; total: number }> {
  const { page = 1, limit = 20, search, ...rest } = filters;
  const skip = (page - 1) * limit;

  const where: Prisma.RfqRequestWhereInput = {};

  if (rest.status) where.status = rest.status;
  if (rest.categoryId) where.categoryId = rest.categoryId;
  if (rest.shippingCountry) where.shippingCountry = rest.shippingCountry;
  if (rest.urgency) where.urgency = rest.urgency;
  if (rest.userId) where.userId = rest.userId;
  if (search) where.title = { contains: search, mode: 'insensitive' };

  // Public listing: only OPEN/NEGOTIATING/QUOTED + PUBLIC or INVITED_ONLY
  if (!isAdmin && !rest.userId) {
    where.status = { in: ['OPEN', 'NEGOTIATING', 'QUOTED'] };
    where.visibility = { not: 'PRIVATE' };
  }

  const [rows, total] = await Promise.all([
    prisma.rfqRequest.findMany({
      where,
      select: CARD_SELECT,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.rfqRequest.count({ where }),
  ]);

  return { items: rows.map(mapCard), total };
}

export async function getRfqBySlug(
  slug: string,
  viewerUserId?: string,
  isAdmin = false
): Promise<RfqRequestDetail | null> {
  const row = await prisma.rfqRequest.findUnique({
    where: { slug },
    select: {
      ...CARD_SELECT,
      description: true,
      productRef: true,
      sourcingNotes: true,
      contactWhatsapp: true,
      contactEmail: true,
      visibility: true,
      attachments: {
        select: { id: true, url: true, name: true, mimeType: true, size: true },
      },
      quotes: { select: QUOTE_SELECT, where: { status: { not: 'WITHDRAWN' } } },
      invites: { select: { supplierId: true } },
    },
  });

  if (!row) return null;

  // Visibility gate
  if (!isAdmin && row.visibility === 'PRIVATE' && row.userId !== viewerUserId) {
    return null;
  }

  // Increment view counter (best-effort, non-blocking)
  prisma.rfqRequest
    .update({ where: { slug }, data: { viewCount: { increment: 1 } } })
    .catch(() => null);

  // Contact details are private — expose only to authenticated viewers
  // (the buyer, an admin, or a logged-in supplier who can submit a quote).
  const canSeeContact = isAdmin || Boolean(viewerUserId);

  return {
    ...mapCard(row),
    description: row.description,
    productRef: row.productRef,
    sourcingNotes: row.sourcingNotes,
    contactWhatsapp: canSeeContact ? row.contactWhatsapp : null,
    contactEmail: canSeeContact ? row.contactEmail : null,
    visibility: row.visibility,
    attachments: row.attachments,
    quotes: (row.quotes as QuoteRow[]).map(mapQuote),
    invitedSupplierIds: row.invites.map((i) => i.supplierId),
  };
}

export async function getRfqById(id: string): Promise<RfqRequestDetail | null> {
  const row = await prisma.rfqRequest.findUnique({ where: { id }, select: { slug: true } });
  if (!row) return null;
  return getRfqBySlug(row.slug, undefined, true);
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Mutations                                                                    */
/* ─────────────────────────────────────────────────────────────────────────── */

export async function createRfq(
  userId: string,
  input: CreateRfqInput,
  opts?: { isAdmin?: boolean }
): Promise<RfqRequestCard> {
  const slug = await generateUniqueRfqSlug(input.title);

  const row = await prisma.rfqRequest.create({
    data: {
      slug,
      userId,
      title: input.title,
      description: input.description,
      categoryId: input.categoryId ?? null,
      productRef: input.productRef ?? null,
      quantity: input.quantity,
      unit: input.unit,
      targetPrice: input.targetPrice ?? null,
      currency: input.currency,
      shippingCountry: input.shippingCountry,
      urgency: input.urgency ?? 'STANDARD',
      visibility: input.visibility ?? 'PUBLIC',
      sourcingNotes: input.sourcingNotes ?? null,
      contactWhatsapp: input.contactWhatsapp ?? null,
      contactEmail: input.contactEmail ?? null,
      expiresAt: input.expiresAt ?? null,
      status: 'DRAFT',  // always start as DRAFT
      attachments: input.attachments
        ? {
            create: input.attachments.map((a) => ({
              url: a.url,
              name: a.name,
              mimeType: a.mimeType ?? null,
              size: a.size ?? null,
            })),
          }
        : undefined,
    },
    select: CARD_SELECT,
  });

  // Moderation gate: admin-created RFQs and deployments with moderation
  // disabled auto-publish (DRAFT → OPEN as a system action); otherwise the
  // RFQ enters PENDING_REVIEW and awaits admin approval before going live.
  const autoPublish = opts?.isAdmin === true || !rfqRequiresModeration();
  if (autoPublish) {
    await transitionRfq(row.id, 'OPEN', SYSTEM_ACTOR, 'createRfq:auto_publish');
  } else {
    await transitionRfq(
      row.id,
      'PENDING_REVIEW',
      { id: userId, role: 'buyer' },
      'createRfq:submit_for_review'
    );
  }

  // Return refreshed card with new status
  const updated = await prisma.rfqRequest.findUniqueOrThrow({ where: { id: row.id }, select: CARD_SELECT });

  // Notify buyer that RFQ was created
  dispatchAutomation({
    eventType: 'RFQ_REQUEST_CREATED',
    userId,
    email: input.contactEmail || undefined,
    dedupeKey: `RFQ_REQUEST_CREATED:${row.id}`,
    vars: {
      name: input.contactWhatsapp || '',
      title: input.title,
      quantity: String(input.quantity),
      unit: input.unit,
      destination: input.shippingCountry,
      link: `/rfq/${row.slug}`,
    },
  }).catch(() => null);

  return mapCard(updated);
}

export async function updateRfq(
  id: string,
  userId: string,
  input: UpdateRfqInput & { attachmentIds?: string[]; attachmentsModified?: boolean },
  isAdmin = false
): Promise<RfqRequestCard | null> {
  const existing = await prisma.rfqRequest.findUnique({
    where: { id },
    select: {
      userId: true,
      status: true,
      quantity: true,
      unit: true,
      targetPrice: true,
      shippingCountry: true,
      description: true,
      attachments: { select: { id: true } },
    },
  });
  if (!existing) return null;
  if (!isAdmin && existing.userId !== userId) return null;

  // Status changes must go through the workflow engine
  const { status: newStatus, attachmentIds, attachmentsModified, ...fieldUpdates } = input;

  // Detect material changes — those that invalidate existing supplier quotes.
  const materialChanges = detectMaterialChanges(existing, fieldUpdates);

  // Attachment changes are also material changes that require reconfirmation
  const hasAttachmentChanges = attachmentsModified === true ||
    (attachmentIds !== undefined && !attachmentsAreEqual(
      existing.attachments.map(a => a.id),
      attachmentIds
    ));

  const row = await prisma.rfqRequest.update({
    where: { id },
    data: {
      ...(fieldUpdates.title && { title: fieldUpdates.title }),
      ...(fieldUpdates.description && { description: fieldUpdates.description }),
      ...(fieldUpdates.categoryId !== undefined && { categoryId: fieldUpdates.categoryId }),
      ...(fieldUpdates.productRef !== undefined && { productRef: fieldUpdates.productRef }),
      ...(fieldUpdates.quantity && { quantity: fieldUpdates.quantity }),
      ...(fieldUpdates.unit && { unit: fieldUpdates.unit }),
      ...(fieldUpdates.targetPrice !== undefined && { targetPrice: fieldUpdates.targetPrice }),
      ...(fieldUpdates.currency && { currency: fieldUpdates.currency }),
      ...(fieldUpdates.shippingCountry && { shippingCountry: fieldUpdates.shippingCountry }),
      ...(fieldUpdates.urgency && { urgency: fieldUpdates.urgency }),
      ...(fieldUpdates.visibility && { visibility: fieldUpdates.visibility }),
      ...(fieldUpdates.sourcingNotes !== undefined && { sourcingNotes: fieldUpdates.sourcingNotes }),
      ...(fieldUpdates.contactWhatsapp !== undefined && { contactWhatsapp: fieldUpdates.contactWhatsapp }),
      ...(fieldUpdates.contactEmail !== undefined && { contactEmail: fieldUpdates.contactEmail }),
      ...(fieldUpdates.expiresAt !== undefined && { expiresAt: fieldUpdates.expiresAt }),
      // Update attachments if provided
      ...(attachmentIds !== undefined && {
        attachments: {
          set: attachmentIds.map((id) => ({ id })),
        },
      }),
    },
    select: CARD_SELECT,
  });

  // Material change → mark active quotes stale + notify suppliers.
  // No silent invalidation: quotes keep their data but are flagged and the
  // supplier is asked to reconfirm or revise.
  const allChanges = [...materialChanges];
  if (hasAttachmentChanges) allChanges.push('attachments');

  if (allChanges.length > 0) {
    await markQuotesStale(id, allChanges);
  }

  // Route status changes through the workflow engine
  if (newStatus && newStatus !== existing.status) {
    const actor: TransitionActor = isAdmin
      ? { id: userId, role: 'admin' }
      : { id: userId, role: 'buyer', flags: ['TRUSTED_BUYER'] };
    await transitionRfq(id, newStatus, actor, 'updateRfq');
    const refreshed = await prisma.rfqRequest.findUniqueOrThrow({ where: { id }, select: CARD_SELECT });
    return mapCard(refreshed);
  }

  return mapCard(row);
}

/** Material RFQ fields whose change invalidates an outstanding quote. */
function detectMaterialChanges(
  existing: { quantity: number; unit: string; targetPrice: unknown; shippingCountry: string; description: string },
  next: Omit<UpdateRfqInput, 'status'>
): string[] {
  const changes: string[] = [];
  if (next.quantity !== undefined && next.quantity !== existing.quantity) changes.push('quantity');
  if (next.unit !== undefined && next.unit !== existing.unit) changes.push('unit');
  if (
    next.targetPrice !== undefined &&
    Number(next.targetPrice) !== (existing.targetPrice != null ? Number(existing.targetPrice) : null)
  ) {
    changes.push('targetPrice');
  }
  if (next.shippingCountry !== undefined && next.shippingCountry !== existing.shippingCountry) {
    changes.push('shippingCountry');
  }
  if (next.description !== undefined && next.description.trim() !== existing.description.trim()) {
    changes.push('specifications');
  }
  return changes;
}

/** Check if two attachment ID arrays are equal (same IDs, any order). */
function attachmentsAreEqual(existing: string[], next: string[]): boolean {
  if (existing.length !== next.length) return false;
  const set = new Set(existing);
  return next.every((id) => set.has(id));
}

/**
 * Flag all active (SUBMITTED) quotes on an RFQ as stale and notify each
 * participating supplier. Best-effort notifications never block the update.
 */
async function markQuotesStale(rfqId: string, changedFields: string[]): Promise<void> {
  const reason = changedFields.join(', ').slice(0, 300);

  const affected = await prisma.rfqQuote.findMany({
    where: { rfqId, status: 'SUBMITTED', isStale: false },
    select: {
      id: true,
      supplier: { select: { name: true, phone: true, user: { select: { email: true, name: true } } } },
    },
  });
  if (affected.length === 0) return;

  await prisma.rfqQuote.updateMany({
    where: { rfqId, status: 'SUBMITTED', isStale: false },
    data: { isStale: true, staleAt: new Date(), staleReason: reason },
  });

  const rfq = await prisma.rfqRequest.findUnique({
    where: { id: rfqId },
    select: { title: true, slug: true },
  });

  for (const q of affected) {
    const email = q.supplier.user?.email;
    const phone = q.supplier.phone;
    if (!email && !phone) continue;
    const vars = {
      name: q.supplier.user?.name ?? q.supplier.name ?? '',
      title: rfq?.title ?? '',
      link: `/rfq/${rfq?.slug ?? ''}`,
      changedFields: changedFields.join(', '),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eventType: any = 'RFQ_STALE'; // Cast until Prisma client regenerated
    dispatchAutomation({
      eventType,
      userId: null,
      email: email || undefined,
      whatsappPhone: phone || undefined,
      dedupeKey: `RFQ_STALE:${q.id}:${reason}`,
      vars,
    }).catch(() => null);
  }
}

export async function cancelRfq(
  id: string,
  userId: string,
  isAdmin = false,
  reason?: string
): Promise<boolean> {
  const existing = await prisma.rfqRequest.findUnique({
    where: { id },
    select: { userId: true, status: true },
  });
  if (!existing) return false;
  if (!isAdmin && existing.userId !== userId) return false;

  const actor: TransitionActor = isAdmin
    ? { id: userId, role: 'admin' }
    : { id: userId, role: 'buyer' };

  try {
    await transitionRfq(id, 'CANCELLED', actor, 'cancelRfq', { reason });
    return true;
  } catch {
    return false;
  }
}

export async function inviteSupplier(
  rfqId: string,
  supplierId: string,
  userId: string,
  isAdmin = false
): Promise<boolean> {
  const rfq = await prisma.rfqRequest.findUnique({
    where: { id: rfqId },
    select: { userId: true, status: true },
  });
  if (!rfq) return false;
  if (!isAdmin && rfq.userId !== userId) return false;
  if (!['OPEN', 'NEGOTIATING'].includes(rfq.status)) return false;

  await prisma.rfqSupplierInvite.upsert({
    where: { rfqId_supplierId: { rfqId, supplierId } },
    create: { rfqId, supplierId },
    update: {},
  });
  return true;
}

/**
 * Recalculate and fix quoteCount for an RFQ.
 * This ensures the denormalized count matches the actual number of quotes.
 * Should be called after any quote operation that might get out of sync.
 */
export async function fixQuoteCount(rfqId: string): Promise<number> {
  const actualCount = await prisma.rfqQuote.count({
    where: { rfqId, status: { not: 'WITHDRAWN' } },
  });

  await prisma.rfqRequest.update({
    where: { id: rfqId },
    data: { quoteCount: actualCount },
  });

  return actualCount;
}

/**
 * Validate and fix all data integrity issues for an RFQ.
 * - Recalculates quoteCount
 * - Returns the corrected data
 */
export async function validateAndFixRfqIntegrity(rfqId: string): Promise<{
  quoteCount: number;
  issues: string[];
}> {
  const issues: string[] = [];

  // Fix quoteCount
  const actualCount = await fixQuoteCount(rfqId);
  const rfq = await prisma.rfqRequest.findUnique({
    where: { id: rfqId },
    select: { quoteCount: true },
  });
  if (rfq && rfq.quoteCount !== actualCount) {
    issues.push(`quoteCount fixed: ${rfq.quoteCount} -> ${actualCount}`);
  }

  return { quoteCount: actualCount, issues };
}
