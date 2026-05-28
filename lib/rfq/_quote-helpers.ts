/**
 * Shared Prisma select + mapper for RfqQuote rows.
 * Internal to lib/rfq — do not export through index.ts.
 */
import 'server-only';

import type { Prisma } from '@prisma/client';
import type { RfqQuoteCard } from './types';

export const QUOTE_SELECT = {
  id:            true,
  rfqId:         true,
  supplierId:    true,
  price:         true,
  currency:      true,
  moq:           true,
  leadTimeDays:  true,
  shippingTerms: true,
  paymentTerms:  true,
  validUntil:    true,
  message:       true,
  attachmentUrl: true,
  status:        true,
  createdAt:     true,
  updatedAt:     true,
  supplier: {
    select: { name: true, tier: true, country: true, ratingAvg: true },
  },
} as const;

export type QuoteRow = Prisma.RfqQuoteGetPayload<{ select: typeof QUOTE_SELECT }>;

export function mapQuote(q: QuoteRow): RfqQuoteCard {
  return {
    id:              q.id,
    rfqId:           q.rfqId,
    supplierId:      q.supplierId,
    supplierName:    q.supplier.name,
    supplierTier:    q.supplier.tier,
    supplierCountry: q.supplier.country,
    supplierRating:  q.supplier.ratingAvg,
    price:           Number(q.price),
    currency:        q.currency,
    moq:             q.moq,
    leadTimeDays:    q.leadTimeDays,
    shippingTerms:   q.shippingTerms,
    paymentTerms:    q.paymentTerms,
    validUntil:      q.validUntil,
    message:         q.message,
    attachmentUrl:   q.attachmentUrl,
    status:          q.status,
    createdAt:       q.createdAt,
    updatedAt:       q.updatedAt,
  };
}
