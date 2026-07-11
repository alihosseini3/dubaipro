import 'server-only';

import { ConversationType, Prisma, SupplierMemberRole } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { memberHasPermission } from '@/lib/auth/permissions';
import { PUBLIC_PRODUCT_WHERE } from '@/lib/products/visibility';
import { notifyMany } from '@/lib/notifications/service';
import { emitConversationMessage } from './emitter';

import type {
  ConversationListQuery,
  SendMessageInput,
  InquiryInput
} from './schemas';

/**
 * Messaging engine — member-based conversations with per-member unread
 * counters, archive flags, and Postgres FTS.
 *
 * Access model:
 *   - A user accesses a thread through their ConversationMember row.
 *   - Org-side self-heal: when a conversation belongs to a supplier org
 *     (conversation.supplierId) and the caller is an active SupplierMember
 *     with the 'supplier.messages' permission but has no member row yet
 *     (e.g. employee hired after the thread started), the row is created
 *     lazily on first access.
 *
 * Consistency: every message insert runs in one transaction with the
 * conversation preview bump and the unread increments, so counters cannot
 * drift from the message log.
 */

export class MessagingError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'MessagingError';
    this.status = status;
  }
}

const PREVIEW_LENGTH = 200;

const MEMBER_SELECT = {
  id: true,
  memberRole: true,
  unreadCount: true,
  lastReadAt: true,
  isArchived: true,
  isMuted: true
} satisfies Prisma.ConversationMemberSelect;

const MESSAGE_SELECT = {
  id: true,
  senderId: true,
  content: true,
  type: true,
  createdAt: true,
  deletedAt: true,
  sender: { select: { id: true, name: true, role: true } },
  attachments: {
    select: { id: true, url: true, fileName: true, mimeType: true, sizeBytes: true }
  }
} satisfies Prisma.MessageSelect;

/* ─── Access resolution ──────────────────────────────────────────────────── */

async function resolveAccess(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, type: true, supplierId: true }
  });
  if (!conversation) throw new MessagingError('Conversation not found', 404);

  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: MEMBER_SELECT
  });
  if (member) return { conversation, member };

  // Org self-heal: active org members with messaging permission may join.
  if (conversation.supplierId) {
    const orgMember = await prisma.supplierMember.findUnique({
      where: { userId },
      select: { supplierId: true, role: true, permissions: true, isActive: true }
    });
    if (
      orgMember?.isActive &&
      orgMember.supplierId === conversation.supplierId &&
      memberHasPermission(orgMember.role, 'supplier.messages', orgMember.permissions)
    ) {
      const created = await prisma.conversationMember.create({
        data: { conversationId, userId, memberRole: 'SUPPLIER' },
        select: MEMBER_SELECT
      });
      return { conversation, member: created };
    }
  }
  throw new MessagingError('Conversation not found', 404);
}

/** Active org members whose role grants messaging — the org-side recipients. */
async function orgRecipientIds(supplierId: string): Promise<string[]> {
  const members = await prisma.supplierMember.findMany({
    where: { supplierId, isActive: true },
    select: { userId: true, role: true, permissions: true }
  });
  return members
    .filter((m) => memberHasPermission(m.role, 'supplier.messages', m.permissions))
    .map((m) => m.userId);
}

/* ─── Conversation creation ──────────────────────────────────────────────── */

type CreateConversationArgs = {
  type: ConversationType;
  subject: string | null;
  supplierId: string | null;
  productId: string | null;
  memberIds: { userId: string; memberRole: string }[];
};

async function createConversation(args: CreateConversationArgs) {
  return prisma.conversation.create({
    data: {
      type: args.type,
      subject: args.subject,
      supplierId: args.supplierId,
      productId: args.productId,
      members: { create: args.memberIds }
    },
    select: { id: true, type: true }
  });
}

/**
 * One DIRECT thread per buyer ↔ supplier org (Alibaba model). Accepts either
 * a supplierId or a productId (resolved to its org).
 */
export async function findOrCreateDirectConversation(params: {
  buyerId: string;
  supplierId?: string;
  productId?: string;
}) {
  let supplierId = params.supplierId ?? null;
  const productId = params.productId ?? null;

  if (!supplierId && productId) {
    const product = await prisma.product.findFirst({
      where: { id: productId, ...PUBLIC_PRODUCT_WHERE },
      select: { supplierId: true }
    });
    if (!product) throw new MessagingError('Product not found', 404);
    supplierId = product.supplierId;
  }
  if (!supplierId) throw new MessagingError('Supplier not found', 404);

  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, status: 'ACTIVE' },
    select: { id: true }
  });
  if (!supplier) throw new MessagingError('Supplier not found', 404);

  // Members of the org talk to buyers, they don't open buyer-side threads
  // with their own org.
  const selfMembership = await prisma.supplierMember.findUnique({
    where: { userId: params.buyerId },
    select: { supplierId: true }
  });
  if (selfMembership?.supplierId === supplierId) {
    throw new MessagingError('You cannot start a conversation with your own company', 400);
  }

  const existing = await prisma.conversation.findFirst({
    where: {
      type: ConversationType.DIRECT,
      supplierId,
      members: { some: { userId: params.buyerId } }
    },
    orderBy: { lastMessageAt: 'desc' },
    select: { id: true, type: true }
  });
  if (existing) return existing;

  const recipients = await orgRecipientIds(supplierId);
  return createConversation({
    type: ConversationType.DIRECT,
    subject: null,
    supplierId,
    productId,
    memberIds: [
      { userId: params.buyerId, memberRole: 'BUYER' },
      ...recipients.map((userId) => ({ userId, memberRole: 'SUPPLIER' }))
    ]
  });
}

/**
 * Product inquiry ("Send inquiry" on the PDP). One INQUIRY thread per
 * buyer+product — repeated inquiries append to the same thread.
 */
export async function createInquiry(buyerId: string, input: InquiryInput) {
  const product = await prisma.product.findFirst({
    where: { id: input.productId, ...PUBLIC_PRODUCT_WHERE },
    select: { id: true, title: true, supplierId: true }
  });
  if (!product) throw new MessagingError('Product not found', 404);

  const selfMembership = await prisma.supplierMember.findUnique({
    where: { userId: buyerId },
    select: { supplierId: true }
  });
  if (selfMembership?.supplierId === product.supplierId) {
    throw new MessagingError('You cannot send an inquiry to your own company', 400);
  }

  const content = `[${input.quantity} ${input.unit}] ${input.message}`;

  const existing = await prisma.conversation.findFirst({
    where: {
      type: ConversationType.INQUIRY,
      productId: product.id,
      members: { some: { userId: buyerId } }
    },
    select: { id: true }
  });
  if (existing) {
    await sendMessage({ conversationId: existing.id, senderId: buyerId, content });
    return { id: existing.id, created: false };
  }

  const recipients = await orgRecipientIds(product.supplierId);
  const conversation = await createConversation({
    type: ConversationType.INQUIRY,
    subject: product.title,
    supplierId: product.supplierId,
    productId: product.id,
    memberIds: [
      { userId: buyerId, memberRole: 'BUYER' },
      ...recipients.map((userId) => ({ userId, memberRole: 'SUPPLIER' }))
    ]
  });
  await sendMessage({ conversationId: conversation.id, senderId: buyerId, content });
  return { id: conversation.id, created: true };
}

/** Sample-request thread — always a fresh conversation per request. */
export async function createSampleConversation(params: {
  buyerId: string;
  supplierId: string;
  productId: string;
  subject: string;
  firstMessage: string;
}) {
  const recipients = await orgRecipientIds(params.supplierId);
  const conversation = await createConversation({
    type: ConversationType.SAMPLE,
    subject: params.subject,
    supplierId: params.supplierId,
    productId: params.productId,
    memberIds: [
      { userId: params.buyerId, memberRole: 'BUYER' },
      ...recipients.map((userId) => ({ userId, memberRole: 'SUPPLIER' }))
    ]
  });
  await sendMessage({
    conversationId: conversation.id,
    senderId: params.buyerId,
    content: params.firstMessage
  });
  return conversation;
}

/** Admin ↔ user SUPPORT thread (contact-form replies). */
export async function getOrCreateSupportConversation(adminId: string, userId: string) {
  const existing = await prisma.conversation.findFirst({
    where: {
      type: ConversationType.SUPPORT,
      AND: [
        { members: { some: { userId: adminId } } },
        { members: { some: { userId } } }
      ]
    },
    select: { id: true }
  });
  if (existing) return existing;

  return createConversation({
    type: ConversationType.SUPPORT,
    subject: null,
    supplierId: null,
    productId: null,
    memberIds: [
      { userId: adminId, memberRole: 'ADMIN' },
      { userId, memberRole: 'BUYER' }
    ]
  });
}

/* ─── Messages ───────────────────────────────────────────────────────────── */

export async function sendMessage(params: {
  conversationId: string;
  senderId: string;
  content: string;
  attachments?: SendMessageInput['attachments'];
  /** SYSTEM messages come from workflow events (sample status changes). */
  type?: 'TEXT' | 'SYSTEM';
}) {
  const content = params.content.trim();
  if (content.length === 0 || content.length > 4000) {
    throw new MessagingError('Message must be 1-4000 characters', 400);
  }
  await resolveAccess(params.conversationId, params.senderId);

  // Debounce snapshot BEFORE the increment: only members who were fully
  // caught up (unreadCount 0) get a "new message" notification — a busy
  // thread produces one ping, not one per message.
  const recipientsBefore =
    params.type === 'SYSTEM'
      ? []
      : await prisma.conversationMember.findMany({
          where: {
            conversationId: params.conversationId,
            userId: { not: params.senderId },
            unreadCount: 0,
            isMuted: false
          },
          select: { userId: true }
        });

  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId: params.conversationId,
        senderId: params.senderId,
        content,
        type: params.type ?? 'TEXT',
        ...(params.attachments?.length
          ? { attachments: { create: params.attachments } }
          : {})
      },
      select: MESSAGE_SELECT
    }),
    prisma.conversation.update({
      where: { id: params.conversationId },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: content.slice(0, PREVIEW_LENGTH)
      }
    }),
    // Recipients: unread +1 and resurface archived threads.
    prisma.conversationMember.updateMany({
      where: {
        conversationId: params.conversationId,
        userId: { not: params.senderId }
      },
      data: { unreadCount: { increment: 1 }, isArchived: false }
    })
  ]);

  if (recipientsBefore.length > 0) {
    void notifyMany(
      recipientsBefore.map((r) => r.userId),
      'message.new',
      { senderName: message.sender.name },
      { link: `/account/messages/${params.conversationId}` }
    ).catch(() => {});
  }

  // Realtime push to open SSE streams (additive — polling stays the fallback).
  emitConversationMessage({
    type: 'message',
    conversationId: params.conversationId,
    message: {
      id: message.id,
      senderId: message.senderId,
      content: message.content,
      type: message.type,
      createdAt: message.createdAt.toISOString(),
      sender: message.sender,
      attachments: message.attachments
    }
  });

  return message;
}

/** Access assertion for transports that live outside this module (SSE). */
export async function assertConversationAccess(
  conversationId: string,
  userId: string
): Promise<void> {
  await resolveAccess(conversationId, userId);
}

export async function listMessages(
  conversationId: string,
  userId: string,
  options: { after?: string } = {}
) {
  await resolveAccess(conversationId, userId);
  return prisma.message.findMany({
    where: {
      conversationId,
      deletedAt: null,
      ...(options.after ? { createdAt: { gt: new Date(options.after) } } : {})
    },
    orderBy: { createdAt: 'asc' },
    take: 200,
    select: MESSAGE_SELECT
  });
}

export async function markRead(conversationId: string, userId: string) {
  const { member } = await resolveAccess(conversationId, userId);
  await prisma.conversationMember.update({
    where: { id: member.id },
    data: { unreadCount: 0, lastReadAt: new Date() }
  });
}

export async function setArchived(
  conversationId: string,
  userId: string,
  archived: boolean
) {
  const { member } = await resolveAccess(conversationId, userId);
  await prisma.conversationMember.update({
    where: { id: member.id },
    data: { isArchived: archived }
  });
}

/* ─── Inbox ──────────────────────────────────────────────────────────────── */

export type ConversationSummary = {
  id: string;
  type: ConversationType;
  subject: string | null;
  counterpartName: string;
  supplier: { id: string; name: string; logoUrl: string | null } | null;
  product: { id: string; title: string; slug: string; imageUrl: string | null } | null;
  lastMessageAt: Date;
  lastMessagePreview: string | null;
  unreadCount: number;
  isArchived: boolean;
};

export async function listConversations(
  userId: string,
  query: ConversationListQuery
): Promise<{ items: ConversationSummary[]; total: number; unreadTotal: number }> {
  const where: Prisma.ConversationMemberWhereInput = {
    userId,
    isArchived: query.archived,
    ...(query.type ? { conversation: { type: query.type } } : {})
  };

  const [rows, total, unread] = await Promise.all([
    prisma.conversationMember.findMany({
      where,
      orderBy: { conversation: { lastMessageAt: 'desc' } },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        unreadCount: true,
        isArchived: true,
        memberRole: true,
        conversation: {
          select: {
            id: true,
            type: true,
            subject: true,
            lastMessageAt: true,
            lastMessagePreview: true,
            supplier: { select: { id: true, name: true, logoUrl: true } },
            product: {
              select: { id: true, title: true, slug: true, imageUrl: true }
            },
            members: {
              where: { userId: { not: userId } },
              take: 1,
              select: { user: { select: { name: true } } }
            }
          }
        }
      }
    }),
    prisma.conversationMember.count({ where }),
    prisma.conversationMember.aggregate({
      where: { userId, isArchived: false },
      _sum: { unreadCount: true }
    })
  ]);

  const items: ConversationSummary[] = rows.map((row) => {
    const convo = row.conversation;
    // Buyer-side sees the company; org/admin side sees the buyer's name.
    const counterpartName =
      row.memberRole === 'BUYER' && convo.supplier
        ? convo.supplier.name
        : (convo.members[0]?.user.name ?? convo.supplier?.name ?? '—');
    return {
      id: convo.id,
      type: convo.type,
      subject: convo.subject,
      counterpartName,
      supplier: convo.supplier,
      product: convo.product,
      lastMessageAt: convo.lastMessageAt,
      lastMessagePreview: convo.lastMessagePreview,
      unreadCount: row.unreadCount,
      isArchived: row.isArchived
    };
  });

  return { items, total, unreadTotal: unread._sum.unreadCount ?? 0 };
}

export async function getConversationHeader(conversationId: string, userId: string) {
  const { member } = await resolveAccess(conversationId, userId);
  const convo = await prisma.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    select: {
      id: true,
      type: true,
      subject: true,
      supplier: { select: { id: true, name: true, slug: true, logoUrl: true } },
      product: { select: { id: true, title: true, slug: true, imageUrl: true } },
      members: {
        where: { userId: { not: userId } },
        take: 1,
        select: { user: { select: { name: true } } }
      }
    }
  });
  const counterpartName =
    member.memberRole === 'BUYER' && convo.supplier
      ? convo.supplier.name
      : (convo.members[0]?.user.name ?? convo.supplier?.name ?? '—');
  return { ...convo, counterpartName, viewerRole: member.memberRole };
}

export async function getUnreadTotal(userId: string): Promise<number> {
  const result = await prisma.conversationMember.aggregate({
    where: { userId, isArchived: false },
    _sum: { unreadCount: true }
  });
  return result._sum.unreadCount ?? 0;
}

/* ─── Search (Postgres FTS over the generated searchVector column) ──────── */

export type MessageSearchHit = {
  conversationId: string;
  messageId: string;
  snippet: string;
  subject: string | null;
  createdAt: Date;
};

export async function searchMessages(
  userId: string,
  query: string
): Promise<MessageSearchHit[]> {
  const rows = await prisma.$queryRaw<
    { conversationId: string; messageId: string; snippet: string; subject: string | null; createdAt: Date }[]
  >`
    SELECT m."conversationId" AS "conversationId",
           m.id               AS "messageId",
           ts_headline('simple', m.content, plainto_tsquery('simple', ${query}),
                       'StartSel=**, StopSel=**, MaxWords=18, MinWords=6') AS snippet,
           c.subject          AS subject,
           m."createdAt"      AS "createdAt"
    FROM "Message" m
    JOIN "ConversationMember" cm
      ON cm."conversationId" = m."conversationId" AND cm."userId" = ${userId}
    JOIN "Conversation" c ON c.id = m."conversationId"
    WHERE m."searchVector" @@ plainto_tsquery('simple', ${query})
      AND m."deletedAt" IS NULL
    ORDER BY m."createdAt" DESC
    LIMIT 20
  `;
  return rows;
}

/* ─── Admin oversight ────────────────────────────────────────────────────── */

export async function listConversationsForAdmin(options: {
  page: number;
  pageSize: number;
  supplierId?: string;
}) {
  const where: Prisma.ConversationWhereInput = options.supplierId
    ? { supplierId: options.supplierId }
    : {};
  const [items, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      orderBy: { lastMessageAt: 'desc' },
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
      select: {
        id: true,
        type: true,
        subject: true,
        lastMessageAt: true,
        lastMessagePreview: true,
        supplier: { select: { name: true } },
        members: { select: { user: { select: { name: true, email: true } } } },
        _count: { select: { messages: true } }
      }
    }),
    prisma.conversation.count({ where })
  ]);
  return { items, total };
}

/** Read-only full thread for oversight (permission 'conversations.oversee'). */
export async function getConversationForAdmin(conversationId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      type: true,
      subject: true,
      supplier: { select: { name: true } },
      product: { select: { title: true } },
      members: { select: { memberRole: true, user: { select: { name: true, email: true } } } },
      messages: {
        orderBy: { createdAt: 'asc' },
        take: 500,
        select: MESSAGE_SELECT
      }
    }
  });
  if (!conversation) throw new MessagingError('Conversation not found', 404);
  return conversation;
}
