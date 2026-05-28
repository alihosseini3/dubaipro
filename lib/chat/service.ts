import { Prisma, UserRole } from '@prisma/client';

import { prisma } from '@/lib/prisma';

export class ChatError extends Error {
  constructor(
    public code:
      | 'peer_not_found'
      | 'invalid_peer'
      | 'self_chat'
      | 'forbidden'
      | 'not_found'
      | 'invalid_content',
    message?: string
  ) {
    super(message ?? code);
  }
}

const SELLER_ROLES = new Set<UserRole>([UserRole.SELLER, UserRole.SUPPLIER]);

/**
 * Resolve a (customer, seller) pair from two arbitrary user ids and roles.
 * Enforces the business rule: customers talk to sellers/suppliers only.
 */
async function resolvePair(userId: string, peerId: string) {
  if (userId === peerId) throw new ChatError('self_chat');

  const [me, peer] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } }),
    prisma.user.findUnique({ where: { id: peerId }, select: { id: true, role: true } })
  ]);
  if (!me || !peer) throw new ChatError('peer_not_found');

  const meIsSeller = SELLER_ROLES.has(me.role);
  const peerIsSeller = SELLER_ROLES.has(peer.role);
  const meIsCustomer = me.role === UserRole.CUSTOMER;
  const peerIsCustomer = peer.role === UserRole.CUSTOMER;

  if (meIsCustomer && peerIsSeller) {
    return { customerId: me.id, sellerId: peer.id };
  }
  if (meIsSeller && peerIsCustomer) {
    return { customerId: peer.id, sellerId: me.id };
  }
  throw new ChatError('invalid_peer');
}

export async function startConversation(userId: string, peerId: string) {
  const { customerId, sellerId } = await resolvePair(userId, peerId);

  try {
    return await prisma.conversation.upsert({
      where: { customerId_sellerId: { customerId, sellerId } },
      update: {},
      create: { customerId, sellerId }
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      return prisma.conversation.findUnique({
        where: { customerId_sellerId: { customerId, sellerId } }
      });
    }
    throw err;
  }
}

export async function assertParticipant(
  conversationId: string,
  userId: string
) {
  const convo = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, customerId: true, sellerId: true }
  });
  if (!convo) throw new ChatError('not_found');
  if (convo.customerId !== userId && convo.sellerId !== userId) {
    throw new ChatError('forbidden');
  }
  return convo;
}

export async function getConversationForUser(
  conversationId: string,
  userId: string
) {
  const convo = await assertParticipant(conversationId, userId);
  return prisma.conversation.findUnique({
    where: { id: convo.id },
    include: {
      customer: { select: { id: true, name: true, email: true, role: true } },
      seller: { select: { id: true, name: true, email: true, role: true } }
    }
  });
}

export async function listMessages(conversationId: string, userId: string) {
  await assertParticipant(conversationId, userId);
  return prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    include: {
      sender: { select: { id: true, name: true, role: true } }
    }
  });
}

export async function sendMessage(params: {
  conversationId: string;
  senderId: string;
  content: string;
}) {
  const { conversationId, senderId, content } = params;
  const trimmed = content.trim();
  if (trimmed.length < 1 || trimmed.length > 4000) {
    throw new ChatError('invalid_content');
  }

  await assertParticipant(conversationId, senderId);

  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: { conversationId, senderId, content: trimmed },
      include: {
        sender: { select: { id: true, name: true, role: true } }
      }
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() }
    })
  ]);
  return message;
}

export async function listUserConversations(userId: string) {
  const rows = await prisma.conversation.findMany({
    where: { OR: [{ customerId: userId }, { sellerId: userId }] },
    orderBy: { updatedAt: 'desc' },
    include: {
      customer: { select: { id: true, name: true, role: true } },
      seller: { select: { id: true, name: true, role: true } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, content: true, senderId: true, createdAt: true }
      }
    }
  });

  return rows.map((c) => {
    const isCustomer = c.customerId === userId;
    const peer = isCustomer ? c.seller : c.customer;
    const lastMessage = c.messages[0] ?? null;
    return {
      id: c.id,
      updatedAt: c.updatedAt,
      peer,
      lastMessage
    };
  });
}

/**
 * Create or get a conversation for admin to reply to a customer.
 * Admin acts as the "seller" side of the conversation.
 * Bypasses role validation since admin can talk to anyone.
 */
export async function getOrCreateAdminConversation(
  adminId: string,
  customerId: string
) {
  if (adminId === customerId) throw new ChatError('self_chat');

  try {
    return await prisma.conversation.upsert({
      where: { customerId_sellerId: { customerId, sellerId: adminId } },
      update: {},
      create: { customerId, sellerId: adminId }
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      const existing = await prisma.conversation.findUnique({
        where: { customerId_sellerId: { customerId, sellerId: adminId } }
      });
      if (existing) return existing;
    }
    throw err;
  }
}

/**
 * Send a message as admin without participant role checks.
 * Admin must be either the customer or seller of the conversation.
 */
export async function sendAdminMessage(params: {
  conversationId: string;
  adminId: string;
  content: string;
}) {
  const { conversationId, adminId, content } = params;
  const trimmed = content.trim();
  if (trimmed.length < 1 || trimmed.length > 4000) {
    throw new ChatError('invalid_content');
  }

  const convo = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, customerId: true, sellerId: true }
  });
  if (!convo) throw new ChatError('not_found');
  if (convo.customerId !== adminId && convo.sellerId !== adminId) {
    throw new ChatError('forbidden');
  }

  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: { conversationId, senderId: adminId, content: trimmed },
      include: {
        sender: { select: { id: true, name: true, role: true } }
      }
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() }
    })
  ]);
  return message;
}

export async function listAllConversations(params?: {
  take?: number;
  skip?: number;
}) {
  return prisma.conversation.findMany({
    orderBy: { updatedAt: 'desc' },
    skip: params?.skip,
    take: params?.take,
    include: {
      customer: { select: { id: true, name: true, email: true } },
      seller: { select: { id: true, name: true, email: true } },
      _count: { select: { messages: true } }
    }
  });
}
