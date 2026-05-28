import { NextResponse } from 'next/server';

import { badRequest, handlePrismaError } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';
import { getCurrentUser } from '@/lib/auth/session';
import { emitAuctionBid } from '@/lib/auctions/emitter';
import { cancelBid, placeBid, updateBid } from '@/lib/auctions/service';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };
type Body = { amount?: unknown; bidId?: unknown };

/**
 * POST /api/auctions/[id]/bid
 *
 * Place a bid on a live auction. Requires an authenticated user (any
 * role except suspended). Validation lives in `placeBid` so the same
 * rules apply if/when an admin tool calls it server-side.
 */
export async function POST(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const parsed = await parseJsonBody<Body>(request);
  if (!parsed.ok) return badRequest(parsed.error);

  const amount = Number(parsed.data.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return badRequest('amount must be a positive number');
  }

  try {
    const result = await placeBid({ auctionId: id, userId: user.id, amount });
    if (!result.ok) {
      const status =
        result.reason === 'not_found'
          ? 404
          : result.reason === 'too_low'
            ? 422
            : 409;
      return NextResponse.json({ error: result.reason }, { status });
    }
    /* Broadcast to all SSE subscribers for this auction. */
    emitAuctionBid({
      type: 'bid',
      auctionId: id,
      currentBid: result.currentBid,
      bidderInitial: user.name.slice(0, 1).toUpperCase(),
      endsAt: result.endsAt,
      totalBids: result.totalBids,
      reserveMet: result.reserveMet,
    });
    return NextResponse.json({ data: result });
  } catch (error) {
    return handlePrismaError(error, `POST /api/auctions/${id}/bid`);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const parsed = await parseJsonBody<Body>(request);
  if (!parsed.ok) return badRequest(parsed.error);

  const bidId = typeof parsed.data.bidId === 'string' ? parsed.data.bidId : '';
  const amount = Number(parsed.data.amount);
  if (!bidId) return badRequest('bidId is required');
  if (!Number.isFinite(amount) || amount <= 0) return badRequest('amount must be a positive number');

  try {
    const result = await updateBid({ auctionId: id, bidId, userId: user.id, amount });
    if (!result.ok) {
      const status = result.reason === 'not_found' ? 404 : result.reason === 'too_low' ? 422 : 409;
      return NextResponse.json({ error: result.reason }, { status });
    }
    emitAuctionBid({
      type: 'bid',
      auctionId: id,
      currentBid: result.currentBid,
      bidderInitial: user.name.slice(0, 1).toUpperCase(),
      endsAt: result.endsAt,
      totalBids: result.totalBids,
      reserveMet: result.reserveMet,
    });
    return NextResponse.json({ data: result });
  } catch (error) {
    return handlePrismaError(error, `PATCH /api/auctions/${id}/bid`);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const parsed = await parseJsonBody<Body>(request);
  if (!parsed.ok) return badRequest(parsed.error);

  const bidId = typeof parsed.data.bidId === 'string' ? parsed.data.bidId : '';
  if (!bidId) return badRequest('bidId is required');

  try {
    const result = await cancelBid({ auctionId: id, bidId, userId: user.id });
    if (!result.ok) {
      const status = result.reason === 'not_found' ? 404 : 409;
      return NextResponse.json({ error: result.reason }, { status });
    }
    emitAuctionBid({
      type: 'bid',
      auctionId: id,
      currentBid: result.currentBid,
      bidderInitial: user.name.slice(0, 1).toUpperCase(),
      endsAt: result.endsAt,
      totalBids: result.totalBids,
      reserveMet: result.reserveMet,
    });
    return NextResponse.json({ data: result });
  } catch (error) {
    return handlePrismaError(error, `DELETE /api/auctions/${id}/bid`);
  }
}
