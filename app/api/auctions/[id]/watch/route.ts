/**
 * POST   /api/auctions/[id]/watch  — add to watchlist
 * DELETE /api/auctions/[id]/watch  — remove from watchlist
 */
import { NextResponse } from 'next/server';

import { handlePrismaError } from '@/lib/api/errors';
import { getCurrentUser } from '@/lib/auth/session';
import { emitAuctionWatch } from '@/lib/auctions/emitter';
import {
  unwatchAuction,
  watchAuction,
} from '@/lib/auctions/service';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

async function getWatcherCount(auctionId: string): Promise<number> {
  return prisma.auctionWatch.count({ where: { auctionId } });
}

export async function POST(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    await watchAuction(id, user.id);
    const count = await getWatcherCount(id);
    emitAuctionWatch({ type: 'watch', auctionId: id, watcherCount: count });
    return NextResponse.json({ data: { watching: true, watcherCount: count } });
  } catch (error) {
    return handlePrismaError(error, `POST /api/auctions/${id}/watch`);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    await unwatchAuction(id, user.id);
    const count = await getWatcherCount(id);
    emitAuctionWatch({ type: 'watch', auctionId: id, watcherCount: count });
    return NextResponse.json({ data: { watching: false, watcherCount: count } });
  } catch (error) {
    return handlePrismaError(error, `DELETE /api/auctions/${id}/watch`);
  }
}
