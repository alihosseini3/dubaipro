import 'server-only';

import { prisma } from '@/lib/prisma';

/**
 * Public route handlers receive `[id]` from the URL that may be either
 * a cuid (id) or a SEO slug. This helper normalises that into the canonical
 * `Supplier.id`. Only ACTIVE rows are visible for public look-ups; admin
 * routes call `getSupplierById` directly.
 */
export async function resolveActiveSupplierIdByParam(
  idOrSlug: string
): Promise<{ id: string; slug: string | null } | null> {
  const row = await prisma.supplier.findFirst({
    where: {
      status: 'ACTIVE',
      OR: [{ id: idOrSlug }, { slug: idOrSlug }]
    },
    select: { id: true, slug: true }
  });
  return row;
}

/**
 * Admin variant — resolves regardless of status, used by `/api/admin/*`
 * and internal tools. Accepts id OR slug as well to keep URL semantics
 * identical between admin and public routes.
 */
export async function resolveAnySupplierIdByParam(
  idOrSlug: string
): Promise<{ id: string; slug: string | null } | null> {
  const row = await prisma.supplier.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    select: { id: true, slug: true }
  });
  return row;
}
