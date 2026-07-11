import { z } from 'zod';

/**
 * Request schemas for the supplier product API (app/api/supplier/products/**)
 * and admin review actions. Currency codes follow the existing 3-letter
 * convention (USD/AED/IRR/EUR/CNY — extensible, so any A-Z triple is valid).
 */

const currency = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'currency must be a 3-letter code');

export const priceTierSchema = z.object({
  currency: currency.default('USD'),
  minQty: z.number().int().min(1),
  maxQty: z.number().int().min(1).nullable().default(null),
  unitPrice: z.number().positive(),
  leadTimeDays: z.number().int().min(0).nullable().default(null)
});

export const replaceTiersSchema = z.object({
  tiers: z.array(priceTierSchema).max(50)
});
export type ReplaceTiersInput = z.infer<typeof replaceTiersSchema>;

export const variantSchema = z.object({
  sku: z.string().trim().max(64).nullable().default(null),
  name: z.string().trim().min(1).max(160),
  options: z.record(z.string(), z.string().max(120)).default({}),
  unitPrice: z.number().positive().nullable().default(null),
  moq: z.number().int().min(1).nullable().default(null),
  stock: z.number().int().min(0).default(0),
  imageUrl: z.string().trim().url().max(2048).nullable().default(null),
  isActive: z.boolean().default(true)
});

export const replaceVariantsSchema = z.object({
  variants: z.array(variantSchema).max(100)
});
export type ReplaceVariantsInput = z.infer<typeof replaceVariantsSchema>;

/** Fields a supplier may create/update on their own product. */
export const supplierProductSchema = z.object({
  title: z.string().trim().min(3).max(200),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'invalid slug')
    .max(200)
    .optional(),
  categoryId: z.string().min(1),
  description: z.string().trim().min(1).max(20000),
  price: z.number().positive(),
  currency: currency.default('USD'),
  stock: z.number().int().min(0).default(0),
  isPublished: z.boolean().default(false),
  imageUrl: z.string().trim().url().max(2048).nullable().optional(),
  images: z
    .array(
      z.object({
        url: z.string().trim().url().max(2048),
        alt: z.string().trim().max(300).optional(),
        order: z.number().int().min(0).optional()
      })
    )
    .max(30)
    .optional(),
  videoUrls: z.array(z.string().trim().url().max(2048)).max(10).optional(),
  moq: z.number().int().min(1).default(1),
  moqUnit: z.string().trim().max(40).default('pieces'),
  samplePrice: z.number().positive().nullable().optional(),
  sampleMOQ: z.number().int().min(1).nullable().optional(),
  tradeTerms: z.string().trim().max(50).nullable().optional(),
  originCountry: z.string().trim().max(100).nullable().optional(),
  leadTimeDays: z.number().int().min(0).nullable().optional(),
  warrantyYears: z.number().int().min(0).nullable().optional(),
  metaTitle: z.string().trim().max(70).nullable().optional(),
  metaDescription: z.string().trim().max(200).nullable().optional(),
  /** Structured spec values keyed by AttributeDefinition slug. */
  attributeValues: z.record(z.string(), z.string().max(500)).optional()
});
export type SupplierProductInput = z.infer<typeof supplierProductSchema>;

export const supplierProductUpdateSchema = supplierProductSchema.partial();
export type SupplierProductUpdateInput = z.infer<typeof supplierProductUpdateSchema>;

export const productStatusActionSchema = z
  .object({
    action: z.enum(['submit', 'archive', 'unarchive']),
    /** Reserved for future supplier-side notes; admin reject uses its own schema. */
    note: z.string().trim().max(1000).optional()
  });
export type ProductStatusActionInput = z.infer<typeof productStatusActionSchema>;

export const adminReviewSchema = z
  .object({
    action: z.enum(['approve', 'reject']),
    reason: z.string().trim().max(2000).optional()
  })
  .refine((v) => v.action !== 'reject' || (v.reason && v.reason.length >= 3), {
    message: 'A rejection reason is required',
    path: ['reason']
  });
export type AdminReviewInput = z.infer<typeof adminReviewSchema>;

export const supplierProductListQuerySchema = z.object({
  status: z
    .enum(['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED'])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});
export type SupplierProductListQuery = z.infer<typeof supplierProductListQuerySchema>;
