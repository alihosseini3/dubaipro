import 'server-only';

import { type Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import { listSuppliers } from './service';
import {
  type Paginated,
  type SupplierCard,
  type SupplierListFilters,
  type SupplierPublic
} from './types';

/**
 * Public storefront read service.
 *
 * Every function here:
 *   1. Hides suppliers whose `status !== 'ACTIVE'` (admins use the
 *      uncapped helpers in `./service.ts`).
 *   2. Returns DTOs, never raw Prisma rows, so sensitive columns
 *      (`verifiedById`, internal notes, etc.) never reach the client.
 */

/** List ACTIVE suppliers only. Thin wrapper around the core service. */
export async function listPublicSuppliers(
  filters: Omit<SupplierListFilters, never> = {}
): Promise<Paginated<SupplierCard>> {
  return listSuppliers({ ...filters, onlyActive: true });
}

/**
 * Resolve a public supplier by slug for the `/{locale}/suppliers/<slug>` page.
 * Returns `null` when the row does not exist OR is not publicly visible.
 */
export async function getPublicSupplierBySlug(
  slug: string
): Promise<SupplierPublic | null> {
  const row = await prisma.supplier.findUnique({
    where: { slug },
    select: PUBLIC_SUPPLIER_SELECT
  });

  if (!row || row.status !== 'ACTIVE') return null;

  return toSupplierPublic(row);
}

/**
 * Resolve a public supplier by id — used by SSR pages that already have
 * the id (e.g. internal cross-links). Same visibility rules as above.
 */
export async function getPublicSupplierById(
  id: string
): Promise<SupplierPublic | null> {
  const row = await prisma.supplier.findUnique({
    where: { id },
    select: PUBLIC_SUPPLIER_SELECT
  });

  if (!row || row.status !== 'ACTIVE') return null;

  return toSupplierPublic(row);
}

/**
 * Increment the `profileViews` counter for a supplier. Rate limiting is
 * the caller's responsibility (one increment per visitor per session is
 * the recommended pattern).
 *
 * Returns the resulting view count or `null` if the supplier no longer exists.
 */
export async function incrementProfileViews(
  supplierId: string
): Promise<number | null> {
  try {
    const updated = await prisma.supplier.update({
      where: { id: supplierId },
      data: { profileViews: { increment: 1 } },
      select: { profileViews: true }
    });
    return updated.profileViews;
  } catch {
    return null;
  }
}

// ─── Internals ────────────────────────────────────────────────────────────

const PUBLIC_SUPPLIER_SELECT = {
  id: true,
  slug: true,
  name: true,
  country: true,
  city: true,
  logoUrl: true,
  bannerUrl: true,
  shortTagline: true,
  description: true,
  businessType: true,
  yearEstablished: true,
  exportMarkets: true,
  minOrderQuantity: true,
  shippingNotes: true,
  tier: true,
  status: true,
  isFeatured: true,
  verifiedAt: true,
  followerCount: true,
  ratingAvg: true,
  ratingCount: true,
  metaTitle: true,
  metaDescription: true,
  createdAt: true,
  _count: { select: { products: true } }
} satisfies Prisma.SupplierSelect;

type PublicRow = Prisma.SupplierGetPayload<{ select: typeof PUBLIC_SUPPLIER_SELECT }>;

function toSupplierPublic(row: PublicRow): SupplierPublic {
  const yearsOnPlatform = Math.max(
    0,
    Math.floor(
      (Date.now() - new Date(row.createdAt).getTime()) /
        (365.25 * 24 * 60 * 60 * 1000)
    )
  );

  return {
    id: row.id,
    slug: row.slug ?? row.id,
    name: row.name,
    shortTagline: row.shortTagline,
    description: row.description,
    country: row.country,
    city: row.city,
    logoUrl: row.logoUrl,
    bannerUrl: row.bannerUrl,
    tier: row.tier,
    isFeatured: row.isFeatured,
    businessType: row.businessType,
    yearEstablished: row.yearEstablished,
    exportMarkets: row.exportMarkets ?? [],
    minOrderQuantity: row.minOrderQuantity,
    shippingNotes: row.shippingNotes,
    followerCount: row.followerCount,
    ratingAvg: row.ratingAvg,
    ratingCount: row.ratingCount,
    productCount: row._count.products,
    metaTitle: row.metaTitle,
    metaDescription: row.metaDescription,
    yearsOnPlatform,
    verifiedAt: row.verifiedAt ? row.verifiedAt.toISOString() : null
  };
}
