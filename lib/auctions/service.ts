import 'server-only';

import { cache } from 'react';

import { prisma } from '@/lib/prisma';

import type { AuctionStatus, Prisma } from '@prisma/client';

/**
 * Auctions service — single read/write surface for the storefront
 * auction pages, the homepage `AuctionSection`, and the admin
 * `/admin/auctions` manager.
 *
 * Money fields are kept in AED (the canonical storage currency) and
 * converted at render time via the existing `<Price>` component, which
 * matches every other catalog row.
 *
 * Listing queries are wrapped in `react.cache()` so the homepage and
 * the dedicated listings page can both call them in the same request
 * without doubling the DB load.
 */

export type AuctionDTO = {
  id: string;
  slug: string;
  title: string;
  description: string;
  imageUrl: string | null;
  startingBid: number;
  currentBid: number;
  reservePrice: number | null;
  reserveMet: boolean;
  minIncrement: number;
  currency: string;
  startsAt: string;
  endsAt: string;
  /** Resolved status — `LIVE` is computed from now() vs. timestamps so
   *  a stale `SCHEDULED` row still flips correctly without a cron. */
  status: AuctionStatus;
  supplierId: string | null;
  supplierName: string | null;
  supplierVerified: boolean;
  supplierCountry: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  winnerUserId: string | null;
  /** Denormalized bid count from the row (not a DB aggregate). */
  bidCount: number;
  totalViews: number;
  watcherCount: number;
  order: number;
};

export type AuctionDetailDTO = AuctionDTO & {
  /** Latest 25 bids, newest first. Bidder names anonymised. */
  recentBids: Array<{
    id: string;
    amount: number;
    currency: string;
    createdAt: string;
    bidderInitial: string;
  }>;
  /** Gallery images sorted by order. */
  images: Array<{ id: string; imageUrl: string; order: number }>;
};

/* -------------------------------------------------------------------------- */
/* Reads                                                                      */
/* -------------------------------------------------------------------------- */

/** Live + scheduled lots, sorted by `endsAt` asc. */
export const listLiveAuctions = cache(
  async (limit = 8): Promise<AuctionDTO[]> => {
    const now = new Date();
    const rows = await prisma.auction
      .findMany({
        where: {
          status: { in: ['LIVE', 'SCHEDULED'] },
          endsAt: { gt: now }
        },
        orderBy: { endsAt: 'asc' },
        take: clamp(limit, 1, 24),
        include: {
          supplier: { select: { name: true, verified: true, country: true } },
          category: { select: { name: true, slug: true } },
          _count: { select: { bids: true, watches: true } }
        }
      })
      .catch(() => []);
    return rows.map(toDTO);
  }
);

/** All auctions with optional status filter (admin + listing page). */
export const listAllAuctions = cache(
  async (status?: AuctionStatus | 'ALL'): Promise<AuctionDTO[]> => {
    const rows = await prisma.auction
      .findMany({
        where: status && status !== 'ALL' ? { status } : undefined,
        orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
        include: {
          supplier: { select: { name: true, verified: true, country: true } },
          category: { select: { name: true, slug: true } },
          _count: { select: { bids: true, watches: true } }
        }
      })
      .catch(() => []);
    return rows.map(toDTO);
  }
);

/** Slug-based lookup for the public detail page. Returns null on miss. */
export async function getAuctionBySlug(
  slug: string
): Promise<AuctionDetailDTO | null> {
  const row = await prisma.auction
    .findUnique({
      where: { slug },
      include: {
        supplier: { select: { name: true, verified: true, country: true } },
        category: { select: { name: true, slug: true } },
        _count: { select: { bids: true, watches: true } },
        bids: {
          orderBy: { createdAt: 'desc' },
          take: 25,
          include: { user: { select: { name: true } } }
        },
        images: { orderBy: { order: 'asc' } }
      }
    })
    .catch(() => null);
  if (!row) return null;
  const base = toDTO(row);
  return {
    ...base,
    recentBids: row.bids.map((b) => ({
      id: b.id,
      amount: Number(b.amount),
      currency: b.currency,
      createdAt: b.createdAt.toISOString(),
      bidderInitial: b.user.name.slice(0, 1).toUpperCase()
    })),
    images: row.images.map((img) => ({
      id: img.id,
      imageUrl: img.imageUrl,
      order: img.order
    }))
  };
}

export type AuctionBidEntry = {
  id: string;
  amount: number;
  currency: string;
  createdAt: string;
  bidderInitial: string;
  bidderName: string;
};

/**
 * Returns all bids for an auction (newest first), with anonymised
 * bidder names (first name + masked surname). Used by the public
 * "all bids" page.
 */
export async function listAuctionBidsBySlug(
  slug: string
): Promise<{ auction: AuctionDetailDTO; bids: AuctionBidEntry[] } | null> {
  const auction = await getAuctionBySlug(slug);
  if (!auction) return null;

  const rows = await prisma.auctionBid
    .findMany({
      where: { auctionId: auction.id },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true } } },
    })
    .catch(() => []);

  const bids: AuctionBidEntry[] = rows.map((b) => {
    const fullName = (b.user.name ?? '').trim();
    const [first = '', ...rest] = fullName.split(/\s+/);
    const last = rest[rest.length - 1] ?? '';
    const masked = last
      ? `${first} ${last.slice(0, 1).toUpperCase()}***`
      : first
        ? `${first.slice(0, 1).toUpperCase()}${first.slice(1, 2).toLowerCase()}***`
        : 'Anonymous';
    return {
      id: b.id,
      amount: Number(b.amount),
      currency: b.currency,
      createdAt: b.createdAt.toISOString(),
      bidderInitial: (first.slice(0, 1) || 'A').toUpperCase(),
      bidderName: masked,
    };
  });

  return { auction, bids };
}

/**
 * Related auctions for cross-promotion. Pulls live + upcoming lots
 * from the same category or supplier, excluding the current one.
 */
export async function listRelatedAuctions({
  excludeId,
  categoryId,
  supplierId,
  limit = 4,
}: {
  excludeId?: string;
  categoryId?: string | null;
  supplierId?: string | null;
  limit?: number;
}): Promise<AuctionDTO[]> {
  const orFilters: Prisma.AuctionWhereInput[] = [];
  if (categoryId) orFilters.push({ categoryId });
  if (supplierId) orFilters.push({ supplierId });
  if (orFilters.length === 0) return [];

  const rows = await prisma.auction
    .findMany({
      where: {
        AND: [
          { id: { not: excludeId } },
          { status: { in: ['LIVE', 'SCHEDULED'] } },
          { endsAt: { gt: new Date() } },
          { OR: orFilters },
        ],
      },
      orderBy: { endsAt: 'asc' },
      take: clamp(limit, 1, 12),
      include: {
        supplier: { select: { name: true, verified: true, country: true } },
        category: { select: { name: true, slug: true } },
        _count: { select: { bids: true, watches: true } },
      },
    })
    .catch(() => []);
  return rows.map(toDTO);
}

/**
 * Fetch gallery URLs for a list of auction IDs, returned as a map
 * `{ [auctionId]: string[] }` in display order. Used by the admin
 * manager so the edit form can pre-fill its `GalleryPicker`.
 */
export async function getGalleriesByAuctionIds(
  ids: string[]
): Promise<Record<string, string[]>> {
  if (ids.length === 0) return {};
  const rows = await prisma.auctionImage
    .findMany({
      where: { auctionId: { in: ids } },
      orderBy: [{ auctionId: 'asc' }, { order: 'asc' }],
      select: { auctionId: true, imageUrl: true },
    })
    .catch(() => [] as { auctionId: string; imageUrl: string }[]);
  const map: Record<string, string[]> = {};
  for (const r of rows) {
    (map[r.auctionId] ??= []).push(r.imageUrl);
  }
  return map;
}

/** Increment view counter non-blocking (best-effort). */
export function incrementViews(id: string): void {
  void prisma.auction
    .update({ where: { id }, data: { totalViews: { increment: 1 } } })
    .catch(() => {});
}

/* -------------------------------------------------------------------------- */
/* Writes                                                                     */
/* -------------------------------------------------------------------------- */

export type CreateAuctionInput = {
  slug: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  startingBid: number;
  reservePrice?: number | null;
  minIncrement?: number;
  currency?: string;
  startsAt: Date;
  endsAt: Date;
  supplierId?: string | null;
  categoryId?: string | null;
  status?: AuctionStatus;
  galleryUrls?: string[];
};

export type UpdateAuctionInput = Partial<
  Omit<CreateAuctionInput, 'slug'>
> & { slug?: string };

export async function createAuction(
  input: CreateAuctionInput
): Promise<AuctionDTO> {
  const last = await prisma.auction
    .findFirst({ orderBy: { order: 'desc' }, select: { order: true } })
    .catch(() => null);
  const nextOrder = (last?.order ?? -1) + 1;

  const row = await prisma.auction.create({
    data: {
      slug: input.slug.trim(),
      title: input.title.trim().slice(0, 200),
      description: (input.description ?? '').slice(0, 5000),
      imageUrl: input.imageUrl?.trim() || null,
      startingBid: input.startingBid,
      currentBid: 0,
      reservePrice: input.reservePrice ?? null,
      minIncrement: input.minIncrement ?? 1,
      currency: (input.currency ?? 'AED').toUpperCase().slice(0, 3),
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      supplierId: input.supplierId ?? null,
      categoryId: input.categoryId ?? null,
      status: input.status ?? 'DRAFT',
      order: nextOrder,
      images: input.galleryUrls && input.galleryUrls.length > 0
        ? {
            create: input.galleryUrls.map((url, i) => ({
              imageUrl: url.trim(),
              order: i
            }))
          }
        : undefined
    },
    include: {
      supplier: { select: { name: true, verified: true, country: true } },
      category: { select: { name: true, slug: true } },
      _count: { select: { bids: true, watches: true } }
    }
  });
  return toDTO(row);
}

export async function updateAuction(
  id: string,
  input: UpdateAuctionInput
): Promise<AuctionDTO> {
  const data: Prisma.AuctionUpdateInput = {};
  if (input.slug !== undefined) data.slug = input.slug.trim();
  if (input.title !== undefined) data.title = input.title.trim().slice(0, 200);
  if (input.description !== undefined)
    data.description = (input.description ?? '').slice(0, 5000);
  if (input.imageUrl !== undefined)
    data.imageUrl = input.imageUrl?.trim() || null;
  if (input.startingBid !== undefined) data.startingBid = input.startingBid;
  if (input.reservePrice !== undefined)
    data.reservePrice = input.reservePrice ?? null;
  if (input.minIncrement !== undefined) data.minIncrement = input.minIncrement;
  if (input.currency !== undefined)
    data.currency = input.currency.toUpperCase().slice(0, 3);
  if (input.startsAt !== undefined) data.startsAt = input.startsAt;
  if (input.endsAt !== undefined) data.endsAt = input.endsAt;
  if (input.status !== undefined) data.status = input.status;
  if (input.supplierId !== undefined)
    data.supplier = input.supplierId
      ? { connect: { id: input.supplierId } }
      : { disconnect: true };
  if (input.categoryId !== undefined)
    data.category = input.categoryId
      ? { connect: { id: input.categoryId } }
      : { disconnect: true };

  /* Gallery sync — if provided, replace the entire image set in a transaction. */
  if (input.galleryUrls !== undefined) {
    await prisma.$transaction([
      prisma.auctionImage.deleteMany({ where: { auctionId: id } }),
      ...(input.galleryUrls.length > 0
        ? [
            prisma.auctionImage.createMany({
              data: input.galleryUrls.map((url, i) => ({
                auctionId: id,
                imageUrl: url.trim(),
                order: i
              }))
            })
          ]
        : [])
    ]);
  }

  const row = await prisma.auction.update({
    where: { id },
    data,
    include: {
      supplier: { select: { name: true, verified: true, country: true } },
      category: { select: { name: true, slug: true } },
      _count: { select: { bids: true, watches: true } }
    }
  });
  return toDTO(row);
}

export async function deleteAuction(id: string): Promise<void> {
  await prisma.auction.delete({ where: { id } });
}

export async function reorderAuctions(ids: string[]): Promise<void> {
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.auction.update({ where: { id }, data: { order: index } })
    )
  );
}

/* -------------------------------------------------------------------------- */
/* Watchlist                                                                  */
/* -------------------------------------------------------------------------- */

export async function watchAuction(auctionId: string, userId: string): Promise<void> {
  await prisma.auctionWatch
    .upsert({
      where: { auctionId_userId: { auctionId, userId } },
      create: { auctionId, userId },
      update: {}
    })
    .catch(() => {});
}

export async function unwatchAuction(auctionId: string, userId: string): Promise<void> {
  await prisma.auctionWatch
    .delete({ where: { auctionId_userId: { auctionId, userId } } })
    .catch(() => {});
}

export async function isWatching(auctionId: string, userId: string): Promise<boolean> {
  const row = await prisma.auctionWatch
    .findUnique({ where: { auctionId_userId: { auctionId, userId } } })
    .catch(() => null);
  return !!row;
}

/* -------------------------------------------------------------------------- */
/* Images                                                                     */
/* -------------------------------------------------------------------------- */

export async function addAuctionImage(
  auctionId: string,
  imageUrl: string,
  order = 0
): Promise<void> {
  await prisma.auctionImage.create({ data: { auctionId, imageUrl, order } });
}

export async function deleteAuctionImage(id: string): Promise<void> {
  await prisma.auctionImage.delete({ where: { id } }).catch(() => {});
}

/**
 * Place a bid on a live auction. All-or-nothing transaction:
 *
 *   1. Re-read the row inside the transaction (avoids a stale-read
 *      racing two simultaneous bidders).
 *   2. Validate amount ≥ floor (currentBid + minIncrement, or
 *      startingBid for the first bid).
 *   3. Validate auction is LIVE and within window.
 *   4. Insert bid + bump `currentBid` atomically.
 */
export type PlaceBidResult =
  | { ok: true; currentBid: number; bidId: string; endsAt: string; totalBids: number; reserveMet: boolean }
  | { ok: false; reason: 'not_found' | 'not_live' | 'too_low' | 'ended' | 'self_bid' };

/** Anti-snipe window — bids within this many ms of endsAt extend the auction. */
const SNIPE_WINDOW_MS = 2 * 60 * 1000; // 2 min
const SNIPE_EXTEND_MS = 2 * 60 * 1000; // extend by 2 min

export async function placeBid({
  auctionId,
  userId,
  amount
}: {
  auctionId: string;
  userId: string;
  amount: number;
}): Promise<PlaceBidResult> {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, reason: 'too_low' };
  }
  return prisma.$transaction(async (tx) => {
    const a = await tx.auction.findUnique({ where: { id: auctionId } });
    if (!a) return { ok: false, reason: 'not_found' as const };

    const now = new Date();
    if (a.endsAt <= now || a.status === 'ENDED' || a.status === 'CANCELLED') {
      return { ok: false, reason: 'ended' as const };
    }
    if (a.status !== 'LIVE' || a.startsAt > now) {
      return { ok: false, reason: 'not_live' as const };
    }
    // Prevent self-bidding (supplier or current winner re-bidding)
    if (a.winnerUserId === userId) {
      return { ok: false, reason: 'self_bid' as const };
    }

    const current = Number(a.currentBid);
    const minInc = Number(a.minIncrement);
    const start = Number(a.startingBid);
    const floor = current > 0 ? current + minInc : start;
    if (amount < floor) {
      return { ok: false, reason: 'too_low' as const };
    }

    // Anti-sniping: extend endsAt if bid within last 2 min
    let newEndsAt = a.endsAt;
    const msLeft = a.endsAt.getTime() - now.getTime();
    if (msLeft < SNIPE_WINDOW_MS) {
      newEndsAt = new Date(a.endsAt.getTime() + SNIPE_EXTEND_MS);
    }

    const bid = await tx.auctionBid.create({
      data: { auctionId, userId, amount, currency: a.currency }
    });
    const updated = await tx.auction.update({
      where: { id: auctionId },
      data: {
        currentBid: amount,
        winnerUserId: userId,
        totalBids: { increment: 1 },
        endsAt: newEndsAt
      }
    });
    const reservePrice = updated.reservePrice ? Number(updated.reservePrice) : null;
    const reserveMet = reservePrice !== null ? amount >= reservePrice : true;

    return {
      ok: true as const,
      currentBid: amount,
      bidId: bid.id,
      endsAt: newEndsAt.toISOString(),
      totalBids: updated.totalBids,
      reserveMet
    };
  });
}

export async function updateBid({
  auctionId,
  bidId,
  userId,
  amount
}: {
  auctionId: string;
  bidId: string;
  userId: string;
  amount: number;
}): Promise<PlaceBidResult> {
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, reason: 'too_low' };

  return prisma.$transaction(async (tx) => {
    const bid = await tx.auctionBid.findFirst({ where: { id: bidId, auctionId, userId } });
    if (!bid) return { ok: false, reason: 'not_found' as const };

    const a = await tx.auction.findUnique({ where: { id: auctionId } });
    if (!a) return { ok: false, reason: 'not_found' as const };

    const now = new Date();
    if (a.endsAt <= now || a.status === 'ENDED' || a.status === 'CANCELLED') {
      return { ok: false, reason: 'ended' as const };
    }
    if (a.status !== 'LIVE' || a.startsAt > now) {
      return { ok: false, reason: 'not_live' as const };
    }

    const otherHighest = await tx.auctionBid.findFirst({
      where: { auctionId, id: { not: bidId } },
      orderBy: [{ amount: 'desc' }, { createdAt: 'desc' }]
    });
    const floor = otherHighest
      ? Number(otherHighest.amount) + Number(a.minIncrement)
      : Number(a.startingBid);
    if (amount < floor) return { ok: false, reason: 'too_low' as const };

    await tx.auctionBid.update({ where: { id: bidId }, data: { amount } });
    const highest = await tx.auctionBid.findFirst({
      where: { auctionId },
      orderBy: [{ amount: 'desc' }, { createdAt: 'desc' }]
    });
    const totalBids = await tx.auctionBid.count({ where: { auctionId } });
    const reservePrice = a.reservePrice ? Number(a.reservePrice) : null;
    const currentBid = highest ? Number(highest.amount) : 0;

    await tx.auction.update({
      where: { id: auctionId },
      data: {
        currentBid,
        winnerUserId: highest?.userId ?? null,
        totalBids
      }
    });

    return {
      ok: true as const,
      currentBid,
      bidId,
      endsAt: a.endsAt.toISOString(),
      totalBids,
      reserveMet: reservePrice !== null ? currentBid >= reservePrice : true
    };
  });
}

export async function cancelBid({
  auctionId,
  bidId,
  userId
}: {
  auctionId: string;
  bidId: string;
  userId: string;
}): Promise<PlaceBidResult> {
  return prisma.$transaction(async (tx) => {
    const bid = await tx.auctionBid.findFirst({ where: { id: bidId, auctionId, userId } });
    if (!bid) return { ok: false, reason: 'not_found' as const };

    const a = await tx.auction.findUnique({ where: { id: auctionId } });
    if (!a) return { ok: false, reason: 'not_found' as const };

    const now = new Date();
    if (a.endsAt <= now || a.status === 'ENDED' || a.status === 'CANCELLED') {
      return { ok: false, reason: 'ended' as const };
    }
    if (a.status !== 'LIVE' || a.startsAt > now) {
      return { ok: false, reason: 'not_live' as const };
    }

    await tx.auctionBid.delete({ where: { id: bidId } });
    const highest = await tx.auctionBid.findFirst({
      where: { auctionId },
      orderBy: [{ amount: 'desc' }, { createdAt: 'desc' }]
    });
    const totalBids = await tx.auctionBid.count({ where: { auctionId } });
    const reservePrice = a.reservePrice ? Number(a.reservePrice) : null;
    const currentBid = highest ? Number(highest.amount) : 0;

    await tx.auction.update({
      where: { id: auctionId },
      data: {
        currentBid,
        winnerUserId: highest?.userId ?? null,
        totalBids
      }
    });

    return {
      ok: true as const,
      currentBid,
      bidId,
      endsAt: a.endsAt.toISOString(),
      totalBids,
      reserveMet: reservePrice !== null ? currentBid >= reservePrice : true
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** Compute the effective status given the row + clock. We keep the
 *  stored status authoritative for DRAFT/CANCELLED/ENDED (admin can
 *  force them), but flip SCHEDULED → LIVE → ENDED automatically. */
function resolveStatus(
  stored: AuctionStatus,
  startsAt: Date,
  endsAt: Date,
  now = new Date()
): AuctionStatus {
  if (stored === 'DRAFT' || stored === 'CANCELLED') return stored;
  if (endsAt <= now) return 'ENDED';
  if (startsAt > now) return 'SCHEDULED';
  return 'LIVE';
}

function toDTO(row: {
  id: string;
  slug: string;
  title: string;
  description: string;
  imageUrl: string | null;
  startingBid: Prisma.Decimal;
  currentBid: Prisma.Decimal;
  reservePrice: Prisma.Decimal | null;
  minIncrement: Prisma.Decimal;
  currency: string;
  startsAt: Date;
  endsAt: Date;
  status: AuctionStatus;
  supplierId: string | null;
  categoryId: string | null;
  winnerUserId: string | null;
  totalBids: number;
  totalViews: number;
  supplier: { name: string; verified: boolean; country: string } | null;
  category: { name: string; slug: string } | null;
  order: number;
  _count: { bids: number; watches: number };
}): AuctionDTO {
  const currentBid = Number(row.currentBid);
  const reservePrice = row.reservePrice ? Number(row.reservePrice) : null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    imageUrl: row.imageUrl,
    startingBid: Number(row.startingBid),
    currentBid,
    reservePrice,
    reserveMet: reservePrice === null ? true : currentBid >= reservePrice,
    minIncrement: Number(row.minIncrement),
    currency: row.currency,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    status: resolveStatus(row.status, row.startsAt, row.endsAt),
    supplierId: row.supplierId,
    supplierName: row.supplier?.name ?? null,
    supplierVerified: row.supplier?.verified ?? false,
    supplierCountry: row.supplier?.country ?? null,
    categoryId: row.categoryId,
    categoryName: row.category?.name ?? null,
    categorySlug: row.category?.slug ?? null,
    winnerUserId: row.winnerUserId,
    bidCount: row.totalBids || row._count.bids,
    totalViews: row.totalViews,
    watcherCount: row._count.watches,
    order: row.order
  };
}

function clamp(n: number, min: number, max: number) {
  if (Number.isNaN(n) || !Number.isFinite(n)) return min;
  return Math.min(Math.max(Math.floor(n), min), max);
}
