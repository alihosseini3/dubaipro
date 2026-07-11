/**
 * GET /api/suppliers/[id]/products
 *
 * Paginated catalog of products belonging to an ACTIVE supplier. The
 * `[id]` segment accepts either the cuid or the SEO slug. Hidden
 * suppliers (suspended / blacklisted / pending) resolve to 404 so we
 * never leak inventory of disabled accounts.
 *
 * Query (all optional):
 *   page, pageSize (1..60), q (title fuzzy), categoryId, sort (recent|price-asc|price-desc)
 */
import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';

import { handlePrismaError, notFound } from '@/lib/api/errors';
import { prisma } from '@/lib/prisma';
import { PUBLIC_PRODUCT_WHERE } from '@/lib/products/visibility';
import { resolveActiveSupplierIdByParam } from '@/lib/suppliers';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

const MAX_PAGE_SIZE = 60;
const DEFAULT_PAGE_SIZE = 24;

export async function GET(request: Request, { params }: Params) {
  const { id: idOrSlug } = await params;

  try {
    const resolved = await resolveActiveSupplierIdByParam(idOrSlug);
    if (!resolved) return notFound('Supplier not found');

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Number(searchParams.get('pageSize')) || DEFAULT_PAGE_SIZE)
    );
    const q = searchParams.get('q')?.trim().slice(0, 120);
    const categoryId = searchParams.get('categoryId')?.trim();
    const sortParam = searchParams.get('sort');

    const where: Prisma.ProductWhereInput = {
      ...PUBLIC_PRODUCT_WHERE,
      supplierId: resolved.id
    };
    if (q && q.length > 0) {
      where.title = { contains: q, mode: 'insensitive' };
    }
    if (categoryId) where.categoryId = categoryId;

    const orderBy: Prisma.ProductOrderByWithRelationInput =
      sortParam === 'price-asc'
        ? { price: 'asc' }
        : sortParam === 'price-desc'
          ? { price: 'desc' }
          : { createdAt: 'desc' };

    const [rows, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          title: true,
          slug: true,
          price: true,
          compareAtPrice: true,
          currency: true,
          stock: true,
          isB2B: true,
          imageUrl: true,
          images: true,
          createdAt: true,
          category: { select: { id: true, name: true, slug: true } },
          brand: { select: { id: true, name: true, slug: true } }
        }
      }),
      prisma.product.count({ where })
    ]);

    return NextResponse.json({
      data: rows,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      }
    });
  } catch (error) {
    return handlePrismaError(error, `GET /api/suppliers/${idOrSlug}/products`);
  }
}
