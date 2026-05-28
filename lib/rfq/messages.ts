import 'server-only';

import { prisma } from '@/lib/prisma';
import type { RfqMessageDTO } from './types';

const MSG_SELECT = {
  id: true,
  rfqId: true,
  quoteId: true,
  senderId: true,
  content: true,
  attachmentUrl: true,
  isRead: true,
  createdAt: true,
  sender: { select: { name: true, role: true } },
} as const;

function mapMsg(m: {
  id: string; rfqId: string; quoteId: string | null; senderId: string;
  content: string; attachmentUrl: string | null; isRead: boolean; createdAt: Date;
  sender: { name: string; role: string };
}): RfqMessageDTO {
  return {
    id: m.id,
    rfqId: m.rfqId,
    quoteId: m.quoteId,
    senderId: m.senderId,
    senderName: m.sender.name,
    senderRole: m.sender.role,
    content: m.content,
    attachmentUrl: m.attachmentUrl,
    isRead: m.isRead,
    createdAt: m.createdAt,
  };
}

export async function getRfqMessages(
  rfqId: string,
  quoteId?: string
): Promise<RfqMessageDTO[]> {
  const where = quoteId ? { rfqId, quoteId } : { rfqId, quoteId: null };
  const rows = await prisma.rfqMessage.findMany({
    where,
    select: MSG_SELECT,
    orderBy: { createdAt: 'asc' },
  });
  return rows.map(mapMsg);
}

export async function sendRfqMessage(
  rfqId: string,
  senderId: string,
  content: string,
  options?: { quoteId?: string; attachmentUrl?: string }
): Promise<RfqMessageDTO> {
  const row = await prisma.rfqMessage.create({
    data: {
      rfqId,
      senderId,
      content,
      quoteId: options?.quoteId ?? null,
      attachmentUrl: options?.attachmentUrl ?? null,
    },
    select: MSG_SELECT,
  });
  return mapMsg(row);
}

export async function markMessagesRead(
  rfqId: string,
  readerId: string
): Promise<void> {
  await prisma.rfqMessage.updateMany({
    where: { rfqId, isRead: false, senderId: { not: readerId } },
    data: { isRead: true },
  });
}

export async function unreadCount(userId: string): Promise<number> {
  // Count unread messages in RFQs where this user is the buyer or supplier
  const buyerRfqs = await prisma.rfqRequest.findMany({
    where: { userId },
    select: { id: true },
  });
  const buyerRfqIds = buyerRfqs.map((r) => r.id);

  const supplier = await prisma.supplier.findUnique({
    where: { userId },
    select: { id: true },
  });
  const supplierQuotes = supplier
    ? await prisma.rfqQuote.findMany({
        where: { supplierId: supplier.id },
        select: { rfqId: true },
      })
    : [];
  const supplierRfqIds = supplierQuotes.map((q) => q.rfqId);

  const allRfqIds = [...new Set([...buyerRfqIds, ...supplierRfqIds])];
  if (allRfqIds.length === 0) return 0;

  return prisma.rfqMessage.count({
    where: {
      rfqId: { in: allRfqIds },
      isRead: false,
      senderId: { not: userId },
    },
  });
}
