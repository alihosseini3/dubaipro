/**
 * GET /api/suppliers/[id]/auctions
 *
 * Lists auction lots belonging to an ACTIVE supplier. Returns LIVE and
 * SCHEDULED auctions by default; pass `?status=ENDED` to see closed
 * lots. DRAFT and CANCELLED rows are never exposed publicly.
 */
import { NextResponse } from 'next/server';
import { AuctionStatus, type Prisma } from '@prisma/client';

import { handlePrismaError, notFound } from '@/lib/api/errors';
import { prisma } from '@/lib/prisma';
import { resolveActiveSupplierIdByParam } from '@/lib/suppliers';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

const MAX_PAGE_SIZE = 60;
const DEFAULT_PAGE_SIZE = 24;

const PUBLIC_STATUSES: AuctionStatus[] = [
  AuctionStatus.LIVE,
  AuctionStatus.SCHEDULED,
  AuctionStatus.ENDED
];

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

    const statusParam = searchParams.get('status')?.toUpperCase();
    const statusFilter: AuctionStatus[] =
      statusParam && (PUBLIC_STATUSES as string[]).includes(statusParam)
        ? [statusParam as AuctionStatus]
        : [AuctionStatus.LIVE, AuctionStatus.SCHEDULED];

    const where: Prisma.AuctionWhereInput = {
      supplierId: resolved.id,
      status: { in: statusFilter }
    };

    const [rows, total] = await Promise.all([
      prisma.auction.findMany({
        where,
        orderBy: [{ status: 'asc' }, { endsAt: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          slug: true,
          title: true,
          imageUrl: true,
          startingBid: true,
          currentBid: true,
          minIncrement: true,
          currency: true,
          startsAt: true,
          endsAt: true,
          status: true,
          reservePrice: true,
          totalBids: true,
          totalViews: true
        }
      }),
      prisma.auction.count({ where })
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
    return handlePrismaError(error, `GET /api/suppliers/${idOrSlug}/auctions`);
  }
}
