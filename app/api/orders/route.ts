import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';

import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { handlePrismaError } from '@/lib/api/errors';

export const runtime = 'nodejs';

const ORDER_STATUSES = [
  'PENDING',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED'
] as const;

/**
 * GET /api/orders
 *
 * - Admins: all orders (optionally filtered by ?status=...)
 * - Customers: only their own orders
 * - Guests: 401
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const statusRaw = searchParams.get('status')?.toUpperCase();
  const status =
    statusRaw && (ORDER_STATUSES as readonly string[]).includes(statusRaw)
      ? (statusRaw as (typeof ORDER_STATUSES)[number])
      : undefined;

  const where: Prisma.OrderWhereInput = {};
  if (user.role !== 'ADMIN') where.userId = user.id;
  if (status) where.status = status;

  try {
    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            product: {
              select: { id: true, title: true, slug: true, imageUrl: true }
            }
          }
        }
      }
    });
    return NextResponse.json({ data: orders });
  } catch (error) {
    return handlePrismaError(error, 'GET /api/orders');
  }
}
