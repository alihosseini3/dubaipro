/**
 * GET /api/supplier/me/followers — count + recent followers list.
 *
 * Returns lightweight user info (id + name only) — emails are never
 * exposed even to the supplier owner to limit PII leakage.
 */
import { NextResponse } from 'next/server';

import { handlePrismaError } from '@/lib/api/errors';
import { getSupplierContextOrNull } from '@/lib/auth/require-supplier';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 20;

export async function GET(request: Request) {
  const ctx = await getSupplierContextOrNull();
  if (!ctx) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(searchParams.get('pageSize')) || DEFAULT_PAGE_SIZE)
  );

  try {
    const [rows, total, supplierMeta] = await Promise.all([
      prisma.supplierFollower.findMany({
        where: { supplierId: ctx.supplier.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          createdAt: true,
          user: { select: { id: true, name: true } }
        }
      }),
      prisma.supplierFollower.count({ where: { supplierId: ctx.supplier.id } }),
      prisma.supplier.findUnique({
        where: { id: ctx.supplier.id },
        select: { followerCount: true }
      })
    ]);

    return NextResponse.json({
      data: rows,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        denormCount: supplierMeta?.followerCount ?? 0
      }
    });
  } catch (error) {
    return handlePrismaError(error, 'GET /api/supplier/me/followers');
  }
}
