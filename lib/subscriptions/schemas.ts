import { z } from 'zod';

/** Request schemas for the subscription APIs. */

const nameTranslations = z
  .record(z.string(), z.string().trim().min(1).max(80))
  .refine((v) => typeof v.en === 'string' && v.en.length > 0, {
    message: 'English name (en) is required'
  });

export const planInputSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_]{2,40}$/, 'code must be A-Z, 0-9, _'),
  nameTranslations,
  price: z.number().min(0),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/),
  intervalMonths: z.number().int().min(1).max(60),
  maxProducts: z.number().int().min(0).nullable(),
  maxEmployees: z.number().int().min(0).nullable(),
  maxImagesPerProduct: z.number().int().min(1).nullable(),
  features: z.record(z.string(), z.unknown()).nullable().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0)
});
export type PlanInputBody = z.infer<typeof planInputSchema>;

export const planUpdateSchema = planInputSchema.partial();

export const assignPlanSchema = z.object({
  supplierId: z.string().min(1),
  planId: z.string().min(1),
  periodMonths: z.number().int().min(1).max(60).optional()
});

export const subscriptionListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(120).optional()
});
