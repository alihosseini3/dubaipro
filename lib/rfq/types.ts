import type {
  RfqRequestStatus,
  RfqVisibility,
  RfqQuoteStatus,
  RfqUrgency,
  SupplierTier,
} from '@prisma/client';

/* ─────────────────────────────────────────────────────────────────────────── */
/* Public DTOs                                                                  */
/* ─────────────────────────────────────────────────────────────────────────── */

export type RfqAttachmentDTO = {
  id: string;
  url: string;
  name: string;
  mimeType: string | null;
  size: number | null;
};

export type RfqRequestCard = {
  id: string;
  slug: string;
  userId: string;
  title: string;
  quantity: number;
  unit: string;
  targetPrice: number | null;
  currency: string;
  shippingCountry: string;
  urgency: RfqUrgency;
  status: RfqRequestStatus;
  quoteCount: number;
  viewCount: number;
  categoryName: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  /** Buyer's public name */
  buyerName: string;
};

export type RfqRequestDetail = RfqRequestCard & {
  description: string;
  productRef: string | null;
  sourcingNotes: string | null;
  /** Buyer contact — only populated for authenticated viewers. */
  contactWhatsapp: string | null;
  contactEmail: string | null;
  visibility: RfqVisibility;
  attachments: RfqAttachmentDTO[];
  quotes: RfqQuoteCard[];
  invitedSupplierIds: string[];
};

export type RfqQuoteCard = {
  id: string;
  rfqId: string;
  supplierId: string;
  supplierName: string;
  supplierTier: SupplierTier;
  supplierCountry: string;
  supplierRating: number;
  price: number;
  currency: string;
  moq: number | null;
  leadTimeDays: number | null;
  shippingTerms: string | null;
  paymentTerms: string | null;
  validUntil: Date | null;
  message: string | null;
  attachmentUrl: string | null;
  status: RfqQuoteStatus;
  isStale: boolean;
  staleReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type RfqMessageDTO = {
  id: string;
  rfqId: string;
  quoteId: string | null;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  attachmentUrl: string | null;
  isRead: boolean;
  createdAt: Date;
};

/* ─────────────────────────────────────────────────────────────────────────── */
/* Input shapes                                                                 */
/* ─────────────────────────────────────────────────────────────────────────── */

export type CreateRfqInput = {
  title: string;
  description: string;
  categoryId?: string;
  productRef?: string;
  quantity: number;
  unit: string;
  targetPrice?: number;
  currency: string;
  shippingCountry: string;
  urgency?: RfqUrgency;
  visibility?: RfqVisibility;
  sourcingNotes?: string;
  contactWhatsapp?: string;
  contactEmail?: string;
  expiresAt?: Date;
  attachments?: Array<{ url: string; name: string; mimeType?: string; size?: number }>;
};

export type UpdateRfqInput = Partial<
  Omit<CreateRfqInput, 'attachments'>
> & { status?: RfqRequestStatus };

export type SubmitQuoteInput = {
  price: number;
  currency: string;
  moq?: number;
  leadTimeDays?: number;
  shippingTerms?: string;
  paymentTerms?: string;
  validUntil?: Date;
  message?: string;
  attachmentUrl?: string;
};

export type RfqListFilters = {
  status?: RfqRequestStatus;
  categoryId?: string;
  shippingCountry?: string;
  urgency?: RfqUrgency;
  userId?: string;
  search?: string;
  page?: number;
  limit?: number;
};
