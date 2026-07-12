import 'server-only';

import { Prisma, ProductStatus } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/utils/slug';
import { setProductAttributeValues } from '@/lib/attributes/service';
import {
  notifyMany,
  orgMemberIdsWithPermission
} from '@/lib/notifications/service';
import { assertCanCreateProduct } from '@/lib/subscriptions/limits';
import {
  canDraftProducts,
  canSubmitProducts,
  type GateReason
} from '@/lib/suppliers/gating';

import { checkTransition, type ActorKind, type ProductAction } from './workflow';
import { validateTierSet, type TierInput } from './tiers';
import type {
  ReplaceVariantsInput,
  SupplierProductInput,
  SupplierProductListQuery,
  SupplierProductUpdateInput
} from './schemas';

/**
 * Product domain service — supplier CRUD, the review workflow, and
 * tier/variant management.
 *
 * Isolation rule: every supplier-facing function takes `supplierId` from the
 * authenticated SupplierContext and scopes ALL queries by it. Ownership
 * misses surface as 404 (not 403) so ids cannot be probed.
 */

export class ProductError extends Error {
  readonly status: number;
  /** Stable machine code so the UI can render the right banner (see GateReason). */
  readonly code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ProductError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Load the gate-relevant supplier columns and evaluate the listing gate.
 * Server-side enforcement — the UI mirrors this but is never trusted.
 */
async function assertGate(
  supplierId: string,
  level: 'draft' | 'submit'
): Promise<void> {
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    select: { onboardingStatus: true, status: true, canListProducts: true }
  });
  if (!supplier) throw new ProductError('Supplier not found', 404);

  const gate =
    level === 'draft' ? canDraftProducts(supplier) : canSubmitProducts(supplier);
  if (!gate.allowed) {
    throw new ProductError(GATE_MESSAGES[gate.reason], 403, gate.reason);
  }
}

const GATE_MESSAGES: Record<GateReason, string> = {
  not_submitted:
    'Complete and submit your supplier application before publishing products.',
  pending_review:
    'Your supplier application is under review. You can keep preparing drafts; publishing unlocks once an admin approves it.',
  rejected:
    'Your supplier application was rejected. Fix the issues and resubmit before publishing products.',
  not_granted: 'Product listing is currently disabled for your account.',
  suspended: 'Your supplier account is suspended.',
  blacklisted: 'Your supplier account is blocked.'
};

const MAX_SLUG_PROBES = 50;

async function generateUniqueProductSlug(
  base: string,
  excludeProductId?: string
): Promise<string> {
  const safeBase = slugify(base) || 'product';
  let candidate = safeBase;
  for (let i = 1; i <= MAX_SLUG_PROBES; i++) {
    const existing = await prisma.product.findUnique({
      where: { slug: candidate },
      select: { id: true }
    });
    if (!existing || existing.id === excludeProductId) return candidate;
    candidate = `${safeBase}-${i + 1}`;
  }
  return `${safeBase}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ─── Supplier CRUD ──────────────────────────────────────────────────────── */

const SUPPLIER_PRODUCT_SELECT = {
  id: true,
  title: true,
  slug: true,
  description: true,
  price: true,
  currency: true,
  stock: true,
  status: true,
  isPublished: true,
  submittedAt: true,
  reviewedAt: true,
  rejectionReason: true,
  imageUrl: true,
  images: true,
  videoUrls: true,
  categoryId: true,
  moq: true,
  moqUnit: true,
  samplePrice: true,
  sampleMOQ: true,
  tradeTerms: true,
  originCountry: true,
  leadTimeDays: true,
  warrantyYears: true,
  metaTitle: true,
  metaDescription: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.ProductSelect;

function scalarData(input: SupplierProductUpdateInput): Prisma.ProductUpdateInput {
  const data: Prisma.ProductUpdateInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.price !== undefined) data.price = input.price;
  if (input.currency !== undefined) data.currency = input.currency;
  if (input.stock !== undefined) data.stock = input.stock;
  if (input.isPublished !== undefined) data.isPublished = input.isPublished;
  if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl;
  if (input.images !== undefined) data.images = input.images;
  if (input.videoUrls !== undefined) data.videoUrls = input.videoUrls;
  if (input.moq !== undefined) data.moq = input.moq;
  if (input.moqUnit !== undefined) data.moqUnit = input.moqUnit;
  if (input.samplePrice !== undefined) data.samplePrice = input.samplePrice;
  if (input.sampleMOQ !== undefined) data.sampleMOQ = input.sampleMOQ;
  if (input.tradeTerms !== undefined) data.tradeTerms = input.tradeTerms;
  if (input.originCountry !== undefined) data.originCountry = input.originCountry;
  if (input.leadTimeDays !== undefined) data.leadTimeDays = input.leadTimeDays;
  if (input.warrantyYears !== undefined) data.warrantyYears = input.warrantyYears;
  if (input.metaTitle !== undefined) data.metaTitle = input.metaTitle;
  if (input.metaDescription !== undefined) data.metaDescription = input.metaDescription;
  return data;
}

export async function createSupplierProduct(
  supplierId: string,
  input: SupplierProductInput
) {
  // Suspended/blacklisted orgs can't touch the catalog at all. A pending
  // applicant CAN prepare drafts — the gate bites at submit time.
  await assertGate(supplierId, 'draft');
  // Plan cap — grandfathered: only new creations are blocked, never existing.
  await assertCanCreateProduct(supplierId);

  const category = await prisma.category.findUnique({
    where: { id: input.categoryId },
    select: { id: true }
  });
  if (!category) throw new ProductError('Category not found', 400);

  const slug = await generateUniqueProductSlug(input.slug ?? input.title);

  const product = await prisma.product.create({
    data: {
      supplierId,
      categoryId: input.categoryId,
      slug,
      title: input.title,
      description: input.description,
      price: input.price,
      currency: input.currency,
      stock: input.stock,
      isB2B: true,
      isPublished: input.isPublished,
      status: ProductStatus.DRAFT,
      imageUrl: input.imageUrl ?? null,
      images: input.images ?? undefined,
      videoUrls: input.videoUrls ?? undefined,
      moq: input.moq,
      moqUnit: input.moqUnit,
      samplePrice: input.samplePrice ?? null,
      sampleMOQ: input.sampleMOQ ?? null,
      tradeTerms: input.tradeTerms ?? null,
      originCountry: input.originCountry ?? null,
      leadTimeDays: input.leadTimeDays ?? null,
      warrantyYears: input.warrantyYears ?? null,
      metaTitle: input.metaTitle ?? null,
      metaDescription: input.metaDescription ?? null
    },
    select: SUPPLIER_PRODUCT_SELECT
  });

  if (input.attributeValues) {
    await setProductAttributeValues(product.id, input.attributeValues);
  }
  return product;
}

async function requireOwnedProduct(supplierId: string, productId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, supplierId },
    select: { id: true, status: true, categoryId: true }
  });
  if (!product) throw new ProductError('Product not found', 404);
  return product;
}

export async function updateSupplierProduct(
  supplierId: string,
  productId: string,
  input: SupplierProductUpdateInput
) {
  await requireOwnedProduct(supplierId, productId);

  if (input.categoryId !== undefined) {
    const category = await prisma.category.findUnique({
      where: { id: input.categoryId },
      select: { id: true }
    });
    if (!category) throw new ProductError('Category not found', 400);
  }

  const data = scalarData(input);
  if (input.categoryId !== undefined) {
    data.category = { connect: { id: input.categoryId } };
  }
  if (input.slug !== undefined && input.slug) {
    data.slug = await generateUniqueProductSlug(input.slug, productId);
  }

  const product = await prisma.product.update({
    where: { id: productId },
    data,
    select: SUPPLIER_PRODUCT_SELECT
  });

  if (input.attributeValues) {
    await setProductAttributeValues(productId, input.attributeValues);
  }
  return product;
}

export async function getSupplierProduct(supplierId: string, productId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, supplierId },
    select: {
      ...SUPPLIER_PRODUCT_SELECT,
      category: { select: { id: true, name: true } },
      priceTiers: {
        orderBy: [{ currency: 'asc' }, { minQty: 'asc' }],
        select: {
          id: true,
          currency: true,
          minQty: true,
          maxQty: true,
          unitPrice: true,
          leadTimeDays: true
        }
      },
      variants: {
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          sku: true,
          name: true,
          options: true,
          unitPrice: true,
          moq: true,
          stock: true,
          imageUrl: true,
          isActive: true
        }
      },
      attributeValues: {
        select: { value: true, attribute: { select: { slug: true } } }
      }
    }
  });
  if (!product) throw new ProductError('Product not found', 404);
  return product;
}

export async function listSupplierProducts(
  supplierId: string,
  query: SupplierProductListQuery
) {
  const where: Prisma.ProductWhereInput = {
    supplierId,
    ...(query.status ? { status: query.status } : {})
  };
  const [items, total, statusCounts] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        title: true,
        slug: true,
        price: true,
        currency: true,
        stock: true,
        status: true,
        isPublished: true,
        imageUrl: true,
        moq: true,
        rejectionReason: true,
        createdAt: true,
        category: { select: { name: true } },
        _count: {
          select: { conversations: { where: { type: 'INQUIRY' } } }
        }
      }
    }),
    prisma.product.count({ where }),
    prisma.product.groupBy({
      by: ['status'],
      where: { supplierId },
      _count: { _all: true }
    })
  ]);
  return {
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
    statusCounts: Object.fromEntries(
      statusCounts.map((s) => [s.status, s._count._all])
    )
  };
}

/* ─── Status workflow ────────────────────────────────────────────────────── */

function transitionData(action: ProductAction, to: ProductStatus, adminId?: string) {
  const data: Prisma.ProductUpdateInput = { status: to };
  if (action === 'submit') {
    data.submittedAt = new Date();
    data.rejectionReason = null;
  }
  if (action === 'approve') {
    data.reviewedAt = new Date();
    data.reviewedById = adminId ?? null;
    data.rejectionReason = null;
  }
  if (action === 'reject') {
    data.reviewedAt = new Date();
    data.reviewedById = adminId ?? null;
  }
  return data;
}

/** Supplier-side transitions: submit / archive / unarchive. */
export async function applySupplierStatusAction(
  supplierId: string,
  productId: string,
  action: Extract<ProductAction, 'submit' | 'archive' | 'unarchive'>
) {
  // Submitting for review = trying to go live → requires admin approval of the
  // supplier application. Archive/unarchive stay open (housekeeping).
  if (action === 'submit') {
    await assertGate(supplierId, 'submit');
  }

  const product = await requireOwnedProduct(supplierId, productId);
  const check = checkTransition(action, product.status, 'supplier');
  if (!check.ok) {
    throw new ProductError(
      `Cannot ${action} a ${product.status} product`,
      409
    );
  }
  return prisma.product.update({
    where: { id: productId },
    data: transitionData(action, check.to),
    select: { id: true, status: true, submittedAt: true }
  });
}

/** Admin review decision: approve or reject (reason required for reject). */
export async function reviewProduct(
  adminId: string,
  productId: string,
  action: Extract<ProductAction, 'approve' | 'reject'>,
  reason?: string
) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, status: true, supplierId: true }
  });
  if (!product) throw new ProductError('Product not found', 404);

  const check = checkTransition(action, product.status, 'admin');
  if (!check.ok) {
    throw new ProductError(`Cannot ${action} a ${product.status} product`, 409);
  }

  const data = transitionData(action, check.to, adminId);
  if (action === 'reject') data.rejectionReason = reason ?? null;

  const updated = await prisma.product.update({
    where: { id: productId },
    data,
    select: { id: true, status: true, supplierId: true, title: true }
  });

  // Tell the org's product editors about the decision (never blocks the review).
  void orgMemberIdsWithPermission(updated.supplierId, 'supplier.products.write')
    .then((userIds) =>
      notifyMany(
        userIds,
        action === 'approve' ? 'product.approved' : 'product.rejected',
        {
          productTitle: updated.title,
          ...(action === 'reject' ? { reason: reason ?? '-' } : {})
        },
        { link: `/supplier/products/${updated.id}/edit` }
      )
    )
    .catch(() => {});

  return updated;
}

export async function listReviewQueue(page: number, pageSize: number) {
  const where: Prisma.ProductWhereInput = { status: ProductStatus.PENDING_REVIEW };
  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { submittedAt: 'asc' }, // oldest submissions first — FIFO fairness
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        title: true,
        slug: true,
        price: true,
        currency: true,
        imageUrl: true,
        moq: true,
        submittedAt: true,
        supplier: { select: { id: true, name: true } },
        category: { select: { name: true } }
      }
    }),
    prisma.product.count({ where })
  ]);
  return { items, total, page, pageSize };
}

/* ─── Tiers & variants ───────────────────────────────────────────────────── */

export async function replaceTiers(
  supplierId: string,
  productId: string,
  tiers: TierInput[]
) {
  await requireOwnedProduct(supplierId, productId);

  const validation = validateTierSet(tiers);
  if (!validation.ok) throw new ProductError(validation.reason, 400);

  const sorted = [...tiers].sort(
    (a, b) => a.currency.localeCompare(b.currency) || a.minQty - b.minQty
  );
  await prisma.$transaction([
    prisma.productPriceTier.deleteMany({ where: { productId } }),
    prisma.productPriceTier.createMany({
      data: sorted.map((tier, index) => ({
        productId,
        currency: tier.currency,
        minQty: tier.minQty,
        maxQty: tier.maxQty,
        unitPrice: tier.unitPrice,
        leadTimeDays: tier.leadTimeDays,
        sortOrder: index
      }))
    })
  ]);
  return prisma.productPriceTier.findMany({
    where: { productId },
    orderBy: [{ currency: 'asc' }, { minQty: 'asc' }],
    select: {
      id: true,
      currency: true,
      minQty: true,
      maxQty: true,
      unitPrice: true,
      leadTimeDays: true
    }
  });
}

export async function replaceVariants(
  supplierId: string,
  productId: string,
  input: ReplaceVariantsInput
) {
  await requireOwnedProduct(supplierId, productId);

  const skus = input.variants
    .map((v) => v.sku)
    .filter((sku): sku is string => !!sku);
  if (new Set(skus).size !== skus.length) {
    throw new ProductError('Duplicate SKUs in variant list', 400);
  }

  await prisma.$transaction([
    prisma.productVariant.deleteMany({ where: { productId } }),
    prisma.productVariant.createMany({
      data: input.variants.map((variant, index) => ({
        productId,
        sku: variant.sku,
        name: variant.name,
        options: variant.options,
        unitPrice: variant.unitPrice,
        moq: variant.moq,
        stock: variant.stock,
        imageUrl: variant.imageUrl,
        isActive: variant.isActive,
        sortOrder: index
      }))
    })
  ]);
  return prisma.productVariant.findMany({
    where: { productId },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      sku: true,
      name: true,
      options: true,
      unitPrice: true,
      moq: true,
      stock: true,
      imageUrl: true,
      isActive: true
    }
  });
}

/* ─── Storefront reads ───────────────────────────────────────────────────── */

export type PublicTier = {
  currency: string;
  minQty: number;
  maxQty: number | null;
  unitPrice: number;
  leadTimeDays: number | null;
};

/** Tiers for the public product page (ProductPriceTier is the only source
 * since the legacy tierPricing Json column was dropped in Phase 7). */
export async function getPublicTiers(productId: string): Promise<PublicTier[]> {
  const rows = await prisma.productPriceTier.findMany({
    where: { productId },
    orderBy: [{ currency: 'asc' }, { minQty: 'asc' }],
    select: {
      currency: true,
      minQty: true,
      maxQty: true,
      unitPrice: true,
      leadTimeDays: true
    }
  });
  return rows.map((row) => ({ ...row, unitPrice: Number(row.unitPrice) }));
}

export async function getPublicVariants(productId: string) {
  return prisma.productVariant.findMany({
    where: { productId, isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      name: true,
      options: true,
      unitPrice: true,
      moq: true,
      stock: true,
      imageUrl: true
    }
  });
}
