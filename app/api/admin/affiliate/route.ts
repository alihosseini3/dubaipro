import { NextResponse } from 'next/server';

import { handlePrismaError } from '@/lib/api/errors';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * Admin overview for /admin/affiliate. Returns latest 100 referrals
 * and 100 commissions plus aggregate totals (per currency, per status).
 * Heavy filtering / pagination can be layered on later — this is enough
 * for an MVP dashboard.
 */
export async function GET() {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const [referrals, commissions, totals] = await Promise.all([
      prisma.referral.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          code: true,
          createdAt: true,
          referrer: { select: { id: true, name: true, email: true } },
          referred: { select: { id: true, name: true, email: true } }
        }
      }),
      prisma.commission.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          orderId: true,
          amount: true,
          currency: true,
          status: true,
          createdAt: true,
          paidAt: true,
          note: true,
          referrer: { select: { id: true, name: true, email: true } }
        }
      }),
      prisma.commission.groupBy({
        by: ['status', 'currency'],
        _sum: { amount: true },
        _count: { _all: true }
      })
    ]);

    return NextResponse.json({
      data: {
        referrals,
        commissions,
        totals: totals.map((t) => ({
          status: t.status,
          currency: t.currency,
          amount: Number(t._sum.amount ?? 0),
          count: t._count._all
        }))
      }
    });
  } catch (error) {
    return handlePrismaError(error, 'GET /api/admin/affiliate');
  }
}
