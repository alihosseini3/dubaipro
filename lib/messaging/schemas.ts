import { z } from 'zod';

/** Request schemas for the conversations / inquiries / samples APIs. */

export const startConversationSchema = z
  .object({
    supplierId: z.string().min(1).optional(),
    productId: z.string().min(1).optional()
  })
  .refine((v) => v.supplierId || v.productId, {
    message: 'supplierId or productId is required'
  });
export type StartConversationInput = z.infer<typeof startConversationSchema>;

export const attachmentSchema = z.object({
  url: z.string().trim().url().max(2048),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(100),
  sizeBytes: z.number().int().min(0).default(0)
});

export const sendMessageSchema = z.object({
  content: z.string().trim().min(1).max(4000),
  attachments: z.array(attachmentSchema).max(5).optional()
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const conversationListQuerySchema = z.object({
  type: z.enum(['DIRECT', 'INQUIRY', 'SAMPLE', 'SUPPORT']).optional(),
  archived: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20)
});
export type ConversationListQuery = z.infer<typeof conversationListQuerySchema>;

export const messagesQuerySchema = z.object({
  /** ISO timestamp — only messages strictly newer are returned (polling). */
  after: z.string().datetime().optional()
});
export type MessagesQuery = z.infer<typeof messagesQuerySchema>;

export const archiveSchema = z.object({ archived: z.boolean() });

export const searchQuerySchema = z.object({
  q: z.string().trim().min(2).max(200)
});

export const inquirySchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(1_000_000),
  unit: z.string().trim().min(1).max(40).default('pieces'),
  message: z.string().trim().min(1).max(4000)
});
export type InquiryInput = z.infer<typeof inquirySchema>;

export const sampleCreateSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(10_000).default(1),
  message: z.string().trim().max(4000).optional(),
  shippingInfo: z
    .object({
      name: z.string().trim().max(120).optional(),
      phone: z.string().trim().max(40).optional(),
      country: z.string().trim().max(80).optional(),
      city: z.string().trim().max(80).optional(),
      address: z.string().trim().max(500).optional()
    })
    .optional()
});
export type SampleCreateInput = z.infer<typeof sampleCreateSchema>;

export const sampleActionSchema = z.object({
  action: z.enum(['accept', 'decline', 'ship', 'close'])
});
export type SampleActionInput = z.infer<typeof sampleActionSchema>;
