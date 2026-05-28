import { NextResponse } from 'next/server';

import { handlePrismaError } from '@/lib/api/errors';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const VALID_SEGMENTS = new Set(['NEW', 'REPEAT', 'HIGH_VALUE', 'INACTIVE']);
const PAGE_SIZE = 50;

/**
 * Customer list with optional segment filter and free-text search.
 *
 * Sorted by lifetimeValue desc so admins see whales first by default.
 * Pagination via `page` (1-indexed) keeps the payload predictable.
 *
 * Also returns top-line dashboard metrics (revenue, AOV, repeat rate,
 * avg LTV) so the same endpoint feeds both the table and the KPI cards.
 */
export async function GET(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const segment = searchParams.get('segment');
  const q = searchParams.get('q')?.trim();
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));

  const where: Record<string, unknown> = {};
  if (segment && VALID_SEGMENTS.has(segment)) where.segment = segment;
  if (q) {
    where.user = {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } }
      ]
    };
  }

  try {
    const [rows, total, kpis] = await Promise.all([
      prisma.userMetrics.findMany({
        where,
        orderBy: { lifetimeValue: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          userId: true,
          totalSpent: true,
          lifetimeValue: true,
          orderCount: true,
          firstOrderAt: true,
          lastOrderAt: true,
          segment: true,
          user: { select: { name: true, email: true, createdAt: true } }
        }
      }),
      prisma.userMetrics.count({ where }),
      computeKpis()
    ]);

    return NextResponse.json({
      data: {
        rows: rows.map((r) => ({
          ...r,
          totalSpent: Number(r.totalSpent),
          lifetimeValue: Number(r.lifetimeValue)
        })),
        total,
        page,
        pageSize: PAGE_SIZE,
        kpis
      }
    });
  } catch (error) {
    return handlePrismaError(error, 'GET /api/admin/customers');
  }
}

async function computeKpis() {
  const [agg, repeatCount, totalCustomers, segmentCounts] = await Promise.all([
    prisma.userMetrics.aggregate({
      _sum: { totalSpent: true },
      _avg: { lifetimeValue: true },
      _count: { _all: true }
    }),
    prisma.userMetrics.count({ where: { orderCount: { gte: 2 } } }),
    prisma.userMetrics.count({ where: { orderCount: { gte: 1 } } }),
    prisma.userMetrics.groupBy({
      by: ['segment'],
      _count: { _all: true }
    })
  ]);

  const segments = Object.fromEntries(
    segmentCounts.map((s) => [s.segment, s._count._all])
  );

  return {
    totalRevenue: Number(agg._sum.totalSpent ?? 0),
    avgLtv: Number(agg._avg.lifetimeValue ?? 0),
    customerCount: agg._count._all,
    repeatRate: totalCustomers > 0 ? repeatCount / totalCustomers : 0,
    segments: {
      NEW: segments.NEW ?? 0,
      REPEAT: segments.REPEAT ?? 0,
      HIGH_VALUE: segments.HIGH_VALUE ?? 0,
      INACTIVE: segments.INACTIVE ?? 0
    }
  };
}
