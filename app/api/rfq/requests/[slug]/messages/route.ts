import { NextResponse } from 'next/server';

import { badRequest, handlePrismaError, notFound } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { getRfqMessages, markMessagesRead, sendRfqMessage } from '@/lib/rfq/messages';
import { getRfqBySlug } from '@/lib/rfq/service';

export const runtime = 'nodejs';

async function canAccessRfq(rfqId: string, userId: string, isAdmin: boolean) {
  if (isAdmin) return true;
  const rfq = await prisma.rfqRequest.findUnique({ where: { id: rfqId }, select: { userId: true } });
  if (!rfq) return false;
  if (rfq.userId === userId) return true;
  const supplier = await prisma.supplier.findUnique({ where: { userId }, select: { id: true } });
  if (!supplier) return false;
  const quote = await prisma.rfqQuote.findUnique({
    where: { rfqId_supplierId: { rfqId, supplierId: supplier.id } },
    select: { id: true },
  });
  return !!quote;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const rfq = await getRfqBySlug(slug, user.id, user.role === 'ADMIN');
    if (!rfq) return notFound('RFQ not found');

    const ok = await canAccessRfq(rfq.id, user.id, user.role === 'ADMIN');
    if (!ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

    const url = new URL(request.url);
    const quoteId = url.searchParams.get('quoteId') ?? undefined;

    const messages = await getRfqMessages(rfq.id, quoteId);
    await markMessagesRead(rfq.id, user.id);

    return NextResponse.json({ data: messages });
  } catch (error) {
    return handlePrismaError(error, `GET /api/rfq/requests/${slug}/messages`);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = await parseJsonBody<{ content: string; quoteId?: string; attachmentUrl?: string }>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const { content, quoteId, attachmentUrl } = parsed.data;

  if (!content?.trim()) return badRequest('content is required');

  try {
    const rfq = await getRfqBySlug(slug, user.id, user.role === 'ADMIN');
    if (!rfq) return notFound('RFQ not found');

    const ok = await canAccessRfq(rfq.id, user.id, user.role === 'ADMIN');
    if (!ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

    const msg = await sendRfqMessage(rfq.id, user.id, content.trim(), { quoteId, attachmentUrl });
    return NextResponse.json({ data: msg }, { status: 201 });
  } catch (error) {
    return handlePrismaError(error, `POST /api/rfq/requests/${slug}/messages`);
  }
}
