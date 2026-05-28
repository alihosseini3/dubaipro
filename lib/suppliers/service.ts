import 'server-only';

import { type Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import { generateUniqueSupplierSlug } from './slug';
import {
  SUPPLIER_LIST_DEFAULT_PAGE_SIZE,
  SUPPLIER_LIST_MAX_PAGE_SIZE,
  type Paginated,
  type SupplierCard,
  type SupplierListFilters
} from './types';

/**
 * Core Supplier CRUD + listing service.
 *
 * This file owns admin-flavoured operations (create / update / delete /
 * list with all filters). Public-facing reads live in `public-service.ts`
 * which composes a strict DTO and only ever returns ACTIVE rows.
 *
 * Counter mutations (followerCount, ratingAvg, ratingCount, profileViews)
 * are owned by their respective sub-services (`follow.ts`, `reviews.ts`).
 * Do NOT mutate them from here — keep the single-writer invariant intact.
 */

/** Admin-facing create payload. Only the truly required fields are mandatory. */
export type CreateSupplierInput = {
  userId: string;
  name: string;
  country: string;
  phone?: string | null;
  /** Optional explicit slug. When omitted, generated from `name`. */
  slug?: string | null;
};

/** Partial update payload — every field optional. */
export type UpdateSupplierInput = Partial<{
  name: string;
  country: string;
  city: string | null;
  phone: string | null;
  slug: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  shortTagline: string | null;
  description: string | null;
  businessType: Prisma.SupplierUpdateInput['businessType'];
  yearEstablished: number | null;
  warehouseAddress: string | null;
  exportMarkets: string[];
  minOrderQuantity: number | null;
  shippingNotes: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
}>;

/**
 * Create a supplier row + assign a unique slug.
 *
 * The caller (admin route) is responsible for verifying the User exists
 * and is not already linked to another supplier (the unique `userId`
 * constraint will surface as P2002 otherwise — handle via `handlePrismaError`).
 */
export async function createSupplier(input: CreateSupplierInput) {
  const slug =
    input.slug && input.slug.length > 0
      ? await generateUniqueSupplierSlug(input.slug)
      : await generateUniqueSupplierSlug(input.name);

  return prisma.supplier.create({
    data: {
      userId: input.userId,
      name: input.name.trim(),
      country: input.country.trim(),
      phone: input.phone ?? null,
      slug
    }
  });
}

/**
 * Patch a supplier. When `slug` is provided we re-run uniqueness so admin
 * edits never produce a collision; passing the same slug is a no-op.
 */
export async function updateSupplier(id: string, patch: UpdateSupplierInput) {
  const data: Prisma.SupplierUpdateInput = { ...patch };

  if (typeof patch.slug === 'string' && patch.slug.length > 0) {
    data.slug = await generateUniqueSupplierSlug(patch.slug, id);
  }

  return prisma.supplier.update({ where: { id }, data });
}

/**
 * Public/admin listing with filters. The caller decides whether to
 * restrict to ACTIVE — admins want to see everything; storefront uses
 * `public-service.listPublicSuppliers`.
 */
export async function listSuppliers(
  filters: SupplierListFilters & { onlyActive?: boolean } = {}
): Promise<Paginated<SupplierCard>> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(
    SUPPLIER_LIST_MAX_PAGE_SIZE,
    Math.max(1, filters.pageSize ?? SUPPLIER_LIST_DEFAULT_PAGE_SIZE)
  );

  const where: Prisma.SupplierWhereInput = {};

  if (filters.onlyActive) where.status = 'ACTIVE';
  if (filters.country) where.country = filters.country;
  if (filters.tier) where.tier = filters.tier;
  if (typeof filters.featured === 'boolean') where.isFeatured = filters.featured;
  if (filters.businessType) where.businessType = filters.businessType;
  if (filters.search && filters.search.trim().length > 0) {
    const q = filters.search.trim();
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { city: { contains: q, mode: 'insensitive' } },
      { country: { contains: q, mode: 'insensitive' } },
      { slug: { contains: q, mode: 'insensitive' } }
    ];
  }

  const orderBy: Prisma.SupplierOrderByWithRelationInput[] = (() => {
    switch (filters.sort) {
      case 'top-rated':
        return [{ ratingAvg: 'desc' }, { ratingCount: 'desc' }];
      case 'most-followed':
        return [{ followerCount: 'desc' }, { createdAt: 'desc' }];
      case 'name':
        return [{ name: 'asc' }];
      case 'recent':
      default:
        return [
          { isFeatured: 'desc' },
          { tier: 'desc' },
          { createdAt: 'desc' }
        ];
    }
  })();

  const [rows, total] = await Promise.all([
    prisma.supplier.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        slug: true,
        name: true,
        country: true,
        logoUrl: true,
        tier: true,
        isFeatured: true,
        shortTagline: true,
        ratingAvg: true,
        ratingCount: true,
        followerCount: true,
        _count: { select: { products: true } }
      }
    }),
    prisma.supplier.count({ where })
  ]);

  const data: SupplierCard[] = rows.map((r) => ({
    id: r.id,
    slug: r.slug ?? r.id, // safe fallback for un-backfilled rows
    name: r.name,
    country: r.country,
    logoUrl: r.logoUrl,
    tier: r.tier,
    isFeatured: r.isFeatured,
    shortTagline: r.shortTagline,
    ratingAvg: r.ratingAvg,
    ratingCount: r.ratingCount,
    followerCount: r.followerCount,
    productCount: r._count.products
  }));

  return {
    data,
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize))
    }
  };
}

/** Cascade-deletes the supplier and all its dependent rows via FK actions. */
export async function deleteSupplier(id: string) {
  return prisma.supplier.delete({ where: { id } });
}

/** Fetch a single supplier by id with all editable columns. */
export async function getSupplierById(id: string) {
  return prisma.supplier.findUnique({ where: { id } });
}

/** Fetch by slug (used by public storefront routes). */
export async function getSupplierBySlug(slug: string) {
  return prisma.supplier.findUnique({ where: { slug } });
}

/** Fetch the supplier owned by a given user id (used by /supplier panel). */
export async function getSupplierByUserId(userId: string) {
  return prisma.supplier.findUnique({ where: { userId } });
}
