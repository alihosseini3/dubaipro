import { NextResponse } from 'next/server';

import { getAdminOrNull } from '@/lib/auth/require-admin';
import { prisma } from '@/lib/prisma';
import { serverError } from '@/lib/api/errors';
import type { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

/**
 * GET /api/admin/payments?status=...&method=...&q=...
 *
 * Admin list of payments with optional filters.
 */
export async function GET(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const method = url.searchParams.get('method');
  const q = url.searchParams.get('q')?.trim();

  const where: Prisma.PaymentWhereInput = {};
  if (status) where.status = status as Prisma.PaymentWhereInput['status'];
  if (method) where.method = method;
  if (q) {
    where.OR = [
      { providerId: { contains: q, mode: 'insensitive' } },
      { referenceNumber: { contains: q, mode: 'insensitive' } },
      { orderId: { contains: q, mode: 'insensitive' } }
    ];
  }

  try {
    const rows = await prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        order: {
          select: {
            id: true,
            totalPrice: true,
            status: true,
            user: { select: { email: true, name: true } }
          }
        }
      }
    });
    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error('GET /api/admin/payments failed:', err);
    return serverError();
  }
}
