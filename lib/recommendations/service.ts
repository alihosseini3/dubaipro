import 'server-only';

import { cache } from 'react';

import { prisma } from '@/lib/prisma';

export type RecommendedProduct = {
  id: string;
  slug: string;
  title: string;
  price: number;
  currency: string;
  image: string | null;
};

/**
 * Related products = same category, different product, in stock.
 * Cheap query — relies on `Product.categoryId` index.
 */
export const getRelatedProducts = cache(async function getRelatedProducts(
  productId: string,
  limit = 8
): Promise<RecommendedProduct[]> {
  const seed = await prisma.product
    .findUnique({ where: { id: productId }, select: { categoryId: true } })
    .catch(() => null);
  if (!seed) return [];

  const rows = await prisma.product
    .findMany({
      where: {
        categoryId: seed.categoryId,
        id: { not: productId }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        slug: true,
        title: true,
        price: true,
        currency: true,
        imageUrl: true
      }
    })
    .catch(() => []);

  return rows.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    price: Number(p.price),
    currency: p.currency,
    image: p.imageUrl ?? null
  }));
});

/**
 * Frequently bought together = products that co-occurred in PAID
 * orders alongside `productId`, ranked by co-occurrence count.
 *
 * Implemented as a single raw query because the join `(orderItem JOIN
 * orderItem)` is awkward to express through the Prisma fluent API and
 * we want the COUNT(*) GROUP BY to happen in pg, not in JS.
 *
 * Falls back gracefully — an empty result just means "not enough order
 * history yet", and the UI can hide the section.
 */
export const getFrequentlyBoughtTogether = cache(
  async function getFrequentlyBoughtTogether(
    productId: string,
    limit = 4
  ): Promise<RecommendedProduct[]> {
    let rows: Array<{
      id: string;
      slug: string;
      title: string;
      price: string | number;
      currency: string;
      image: string | null;
      cooccurrence: bigint | number;
    }> = [];

    try {
      rows = await prisma.$queryRaw<typeof rows>`
        SELECT
          p."id", p."slug", p."title", p."price", p."currency",
          p."imageUrl" AS "image",
          COUNT(*) AS "cooccurrence"
        FROM "OrderItem" a
        JOIN "OrderItem" b ON b."orderId" = a."orderId" AND b."productId" <> a."productId"
        JOIN "Order" o ON o."id" = a."orderId"
        JOIN "Product" p ON p."id" = b."productId"
        WHERE a."productId" = ${productId}
          AND o."paymentStatus" = 'PAID'
        GROUP BY p."id"
        ORDER BY "cooccurrence" DESC, p."createdAt" DESC
        LIMIT ${limit}
      `;
    } catch {
      return [];
    }

    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      price: typeof r.price === 'number' ? r.price : Number(r.price),
      currency: r.currency,
      image: r.image
    }));
  }
);
