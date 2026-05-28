import 'server-only';

import { prisma } from '@/lib/prisma';
import { dispatchAutomation } from '@/lib/automation/dispatch';
import type { RfqQuoteStatus } from '@prisma/client';

import { QUOTE_SELECT, QuoteRow, mapQuote } from './_quote-helpers';
import { transitionRfq, SYSTEM_ACTOR } from './workflow';
import { canTransitionQuote } from './status-machine';
import type { SubmitQuoteInput, RfqQuoteCard } from './types';

/** Supplier submits or updates a quote on an open RFQ. */
export async function submitQuote(
  rfqId: string,
  supplierId: string,
  input: SubmitQuoteInput
): Promise<{ ok: boolean; quote?: RfqQuoteCard; error?: string }> {
  const rfq = await prisma.rfqRequest.findUnique({
    where: { id: rfqId },
    select: { status: true, userId: true, title: true, user: { select: { email: true, name: true } } },
  });
  if (!rfq) return { ok: false, error: 'rfq_not_found' };
  if (!['OPEN', 'NEGOTIATING', 'QUOTED'].includes(rfq.status)) {
    return { ok: false, error: 'rfq_closed' };
  }

  const existing = await prisma.rfqQuote.findUnique({
    where: { rfqId_supplierId: { rfqId, supplierId } },
    select: { id: true, status: true },
  });

  let quote;
  if (existing) {
    if (existing.status === 'WITHDRAWN') {
      return { ok: false, error: 'quote_withdrawn' };
    }
    quote = await prisma.rfqQuote.update({
      where: { id: existing.id },
      data: {
        price: input.price,
        currency: input.currency,
        moq: input.moq ?? null,
        leadTimeDays: input.leadTimeDays ?? null,
        shippingTerms: input.shippingTerms ?? null,
        paymentTerms: input.paymentTerms ?? null,
        validUntil: input.validUntil ?? null,
        message: input.message ?? null,
        attachmentUrl: input.attachmentUrl ?? null,
        status: 'SUBMITTED',
      },
      select: QUOTE_SELECT,
    });
  } else {
    // New quote — create and auto-transition RFQ from OPEN → QUOTED
    quote = await prisma.rfqQuote.create({
      data: {
        rfqId,
        supplierId,
        price: input.price,
        currency: input.currency,
        moq: input.moq ?? null,
        leadTimeDays: input.leadTimeDays ?? null,
        shippingTerms: input.shippingTerms ?? null,
        paymentTerms: input.paymentTerms ?? null,
        validUntil: input.validUntil ?? null,
        message: input.message ?? null,
        attachmentUrl: input.attachmentUrl ?? null,
      },
      select: QUOTE_SELECT,
    });

    // Increment denormalized counter
    await prisma.rfqRequest.update({
      where: { id: rfqId },
      data: { quoteCount: { increment: 1 } },
    });

    // Auto-transition OPEN → QUOTED when first quote arrives
    if (rfq.status === 'OPEN') {
      await transitionRfq(rfqId, 'QUOTED', SYSTEM_ACTOR, 'first_quote_received', {
        metadata: { supplierId, quoteId: quote.id },
      });
    }

    // Notify buyer (best-effort)
    dispatchAutomation({
      eventType: 'RFQ_QUOTE_RECEIVED',
      userId: rfq.userId,
      email: rfq.user.email,
      dedupeKey: `RFQ_QUOTE_RECEIVED:${rfqId}:${supplierId}`,
      vars: { name: rfq.user.name, product: rfq.title, price: `${input.price} ${input.currency}`, link: `/rfq/${rfqId}` },
    }).catch(() => null);
  }

  return { ok: true, quote: mapQuote(quote) };
}

/** Buyer accepts a specific quote — transitions RFQ to ACCEPTED. */
export async function acceptQuote(
  quoteId: string,
  buyerUserId: string
): Promise<{ ok: boolean; error?: string }> {
  const quote = await prisma.rfqQuote.findUnique({
    where: { id: quoteId },
    select: {
      rfqId: true, supplierId: true, status: true, price: true, currency: true,
      rfq: { select: { userId: true, title: true, status: true } },
      supplier: { select: { user: { select: { email: true, name: true } } } },
    },
  });
  if (!quote) return { ok: false, error: 'quote_not_found' };
  if (quote.rfq.userId !== buyerUserId) return { ok: false, error: 'forbidden' };
  if (quote.status !== 'SUBMITTED') return { ok: false, error: 'invalid_status' };

  // 1. Accept the chosen quote, reject all others
  await prisma.$transaction([
    prisma.rfqQuote.update({ where: { id: quoteId }, data: { status: 'ACCEPTED' } }),
    prisma.rfqQuote.updateMany({
      where: { rfqId: quote.rfqId, id: { not: quoteId }, status: 'SUBMITTED' },
      data: { status: 'REJECTED' },
    }),
  ]);

  // 2. Transition RFQ → ACCEPTED via workflow (audit + outbox)
  await transitionRfq(
    quote.rfqId,
    'ACCEPTED',
    { id: buyerUserId, role: 'buyer' },
    'acceptQuote',
    { metadata: { quoteId, supplierId: quote.supplierId } }
  );

  // 3. Notify winning supplier (best-effort)
  const supplierEmail = quote.supplier.user?.email;
  if (supplierEmail) {
    dispatchAutomation({
      eventType: 'RFQ_QUOTE_ACCEPTED',
      userId: null,
      email: supplierEmail,
      dedupeKey: `RFQ_QUOTE_ACCEPTED:${quoteId}`,
      vars: {
        name: quote.supplier.user?.name ?? '',
        product: quote.rfq.title,
        price: `${Number(quote.price)} ${quote.currency}`,
        link: `/supplier/rfq`,
      },
    }).catch(() => null);
  }

  return { ok: true };
}

/** Buyer rejects a specific quote (does NOT change RFQ status). */
export async function rejectQuote(
  quoteId: string,
  buyerUserId: string
): Promise<{ ok: boolean; error?: string }> {
  const quote = await prisma.rfqQuote.findUnique({
    where: { id: quoteId },
    select: { rfqId: true, status: true, rfq: { select: { userId: true } } },
  });
  if (!quote) return { ok: false, error: 'quote_not_found' };
  if (quote.rfq.userId !== buyerUserId) return { ok: false, error: 'forbidden' };
  if (!canTransitionQuote(quote.status as RfqQuoteStatus, 'REJECTED')) {
    return { ok: false, error: 'invalid_status' };
  }

  await prisma.rfqQuote.update({ where: { id: quoteId }, data: { status: 'REJECTED' } });
  return { ok: true };
}

/** Supplier withdraws their own quote. Auto-transitions RFQ back to OPEN if last quote. */
export async function withdrawQuote(
  quoteId: string,
  supplierId: string
): Promise<{ ok: boolean; error?: string }> {
  const quote = await prisma.rfqQuote.findUnique({
    where: { id: quoteId },
    select: { supplierId: true, status: true, rfqId: true, rfq: { select: { status: true } } },
  });
  if (!quote) return { ok: false, error: 'quote_not_found' };
  if (quote.supplierId !== supplierId) return { ok: false, error: 'forbidden' };
  if (!canTransitionQuote(quote.status as RfqQuoteStatus, 'WITHDRAWN')) {
    return { ok: false, error: 'invalid_status' };
  }

  await prisma.$transaction([
    prisma.rfqQuote.update({ where: { id: quoteId }, data: { status: 'WITHDRAWN' } }),
    prisma.rfqRequest.update({
      where: { id: quote.rfqId },
      data: { quoteCount: { decrement: 1 } },
    }),
  ]);

  // Auto-transition QUOTED → OPEN when last active quote is withdrawn
  if (quote.rfq.status === 'QUOTED') {
    const remaining = await prisma.rfqQuote.count({
      where: { rfqId: quote.rfqId, status: { in: ['SUBMITTED', 'ACCEPTED'] } },
    });
    if (remaining === 0) {
      await transitionRfq(quote.rfqId, 'OPEN', SYSTEM_ACTOR, 'all_quotes_withdrawn', {
        metadata: { lastWithdrawnQuoteId: quoteId },
      });
    }
  }

  return { ok: true };
}
