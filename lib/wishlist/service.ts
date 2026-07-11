import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { PUBLIC_PRODUCT_WHERE } from '@/lib/products/visibility';

/**
 * Lazily creates the user's wishlist row on first interaction.
 * Uses an upsert so concurrent first-visits don't race.
 */
async function getOrCreateWishlist(userId: string): Promise<string> {
  const row = await prisma.wishlist.upsert({
    where: { userId },
    update: {},
    create: { userId },
    select: { id: true }
  });
  return row.id;
}

export async function getWishlistProductIds(
  userId: string
): Promise<Set<string>> {
  const rows = await prisma.wishlistItem.findMany({
    where: { wishlist: { userId } },
    select: { productId: true }
  });
  return new Set(rows.map((r) => r.productId));
}

export async function getWishlistCount(userId: string): Promise<number> {
  return prisma.wishlistItem.count({
    where: { wishlist: { userId } }
  });
}

export type WishlistToggleResult = {
  added: boolean;
  count: number;
};

/**
 * Idempotent toggle — if the unique row exists, delete it; otherwise create it.
 * Handles P2002 (race on concurrent creates) by reverting to delete, and
 * P2025 (race on concurrent deletes) by treating as already removed.
 */
export async function toggleWishlistProduct(
  userId: string,
  productId: string
): Promise<WishlistToggleResult> {
  // Guard: product must exist and be publicly visible. Avoids polluting
  // the wishlist with stale or unapproved ids.
  const product = await prisma.product.findFirst({
    where: { id: productId, ...PUBLIC_PRODUCT_WHERE },
    select: { id: true }
  });
  if (!product) {
    throw new Error('product_not_found');
  }

  const wishlistId = await getOrCreateWishlist(userId);

  const existing = await prisma.wishlistItem.findUnique({
    where: { wishlistId_productId: { wishlistId, productId } },
    select: { id: true }
  });

  if (existing) {
    try {
      await prisma.wishlistItem.delete({ where: { id: existing.id } });
    } catch (err) {
      if (
        !(
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2025'
        )
      ) {
        throw err;
      }
    }
    const count = await getWishlistCount(userId);
    return { added: false, count };
  }

  try {
    await prisma.wishlistItem.create({
      data: { wishlistId, productId }
    });
  } catch (err) {
    // Concurrent insert race — unique constraint; treat as already added.
    if (
      !(
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      )
    ) {
      throw err;
    }
  }
  const count = await getWishlistCount(userId);
  return { added: true, count };
}

export type WishlistItemWithProduct = NonNullable<
  Awaited<ReturnType<typeof listWishlistItems>>[number]
>;

export async function listWishlistItems(userId: string) {
  return prisma.wishlistItem.findMany({
    where: { wishlist: { userId } },
    orderBy: { createdAt: 'desc' },
    include: {
      product: {
        select: {
          id: true,
          title: true,
          slug: true,
          imageUrl: true,
          price: true,
          currency: true,
          stock: true,
          isB2B: true,
          category: { select: { id: true, name: true, slug: true } },
          supplier: { select: { id: true, name: true } }
        }
      }
    }
  });
}
