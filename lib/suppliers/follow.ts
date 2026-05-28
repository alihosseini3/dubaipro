import 'server-only';

import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

/**
 * Follow / unfollow a supplier.
 *
 * The composite `(supplierId, userId)` unique index makes follows
 * idempotent at the DB level. The denormalised `Supplier.followerCount`
 * is maintained inside a single transaction so concurrent followers
 * cannot drift the counter (PG row-level locking on UPDATE).
 *
 * Returns the resulting state so the client can render the toggle
 * without a follow-up read.
 */

export type FollowState = {
  following: boolean;
  followerCount: number;
};

export async function followSupplier(
  supplierId: string,
  userId: string
): Promise<FollowState> {
  return prisma.$transaction(async (tx) => {
    try {
      await tx.supplierFollower.create({
        data: { supplierId, userId }
      });
    } catch (e) {
      // P2002 = already following → idempotent success.
      if (
        !(
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        )
      ) {
        throw e;
      }
      const current = await tx.supplier.findUnique({
        where: { id: supplierId },
        select: { followerCount: true }
      });
      return {
        following: true,
        followerCount: current?.followerCount ?? 0
      };
    }

    const updated = await tx.supplier.update({
      where: { id: supplierId },
      data: { followerCount: { increment: 1 } },
      select: { followerCount: true }
    });

    return { following: true, followerCount: updated.followerCount };
  });
}

export async function unfollowSupplier(
  supplierId: string,
  userId: string
): Promise<FollowState> {
  return prisma.$transaction(async (tx) => {
    const deleted = await tx.supplierFollower.deleteMany({
      where: { supplierId, userId }
    });

    if (deleted.count === 0) {
      const current = await tx.supplier.findUnique({
        where: { id: supplierId },
        select: { followerCount: true }
      });
      return {
        following: false,
        followerCount: current?.followerCount ?? 0
      };
    }

    // Guard against counter going negative if the row drifted historically.
    const updated = await tx.supplier.update({
      where: { id: supplierId },
      data: { followerCount: { decrement: 1 } },
      select: { followerCount: true }
    });

    return {
      following: false,
      followerCount: Math.max(0, updated.followerCount)
    };
  });
}

/** Check whether a user already follows a supplier. */
export async function isFollowing(
  supplierId: string,
  userId: string
): Promise<boolean> {
  const row = await prisma.supplierFollower.findUnique({
    where: { supplierId_userId: { supplierId, userId } },
    select: { id: true }
  });
  return !!row;
}

/**
 * Recompute and persist `Supplier.followerCount` from the source-of-truth
 * `SupplierFollower` rows. Useful for one-off repairs and admin tools.
 */
export async function recomputeFollowerCount(supplierId: string): Promise<number> {
  const count = await prisma.supplierFollower.count({ where: { supplierId } });
  await prisma.supplier.update({
    where: { id: supplierId },
    data: { followerCount: count }
  });
  return count;
}
