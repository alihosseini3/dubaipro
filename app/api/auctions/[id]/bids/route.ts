import { NextResponse } from 'next/server';

import { handlePrismaError } from '@/lib/api/errors';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const bids = await prisma.auctionBid.findMany({
      where: { auctionId: id, userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        amount: true,
        currency: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      data: bids.map((bid) => ({
        id: bid.id,
        amount: Number(bid.amount),
        currency: bid.currency,
        createdAt: bid.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return handlePrismaError(error, `GET /api/auctions/${id}/bids`);
  }
}
