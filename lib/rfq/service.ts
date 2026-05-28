import 'server-only';

import type { RfqRequestStatus, RfqVisibility, Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import { generateUniqueRfqSlug } from './slug';
import { transitionRfq, type TransitionActor } from './workflow';
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

  return {
    ...mapCard(row),
    description: row.description,
    productRef: row.productRef,
    sourcingNotes: row.sourcingNotes,
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
  actor?: TransitionActor
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

  // Immediately publish if actor has TRUSTED_BUYER flag, otherwise PENDING_REVIEW
  const resolvedActor = actor ?? { id: userId, role: 'buyer' as const, flags: ['TRUSTED_BUYER'] };
  const targetStatus = resolvedActor.flags?.includes('TRUSTED_BUYER') ? 'OPEN' : 'PENDING_REVIEW';
  await transitionRfq(row.id, targetStatus, resolvedActor, 'createRfq');

  // Return refreshed card with new status
  const updated = await prisma.rfqRequest.findUniqueOrThrow({ where: { id: row.id }, select: CARD_SELECT });
  return mapCard(updated);
}

export async function updateRfq(
  id: string,
  userId: string,
  input: UpdateRfqInput,
  isAdmin = false
): Promise<RfqRequestCard | null> {
  const existing = await prisma.rfqRequest.findUnique({
    where: { id },
    select: { userId: true, status: true },
  });
  if (!existing) return null;
  if (!isAdmin && existing.userId !== userId) return null;

  // Status changes must go through the workflow engine
  const { status: newStatus, ...fieldUpdates } = input;

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
      ...(fieldUpdates.expiresAt !== undefined && { expiresAt: fieldUpdates.expiresAt }),
    },
    select: CARD_SELECT,
  });

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
