import 'server-only';
import { prisma } from '@/lib/prisma';

const TRENDING_THRESHOLD = 3;
const NEW_ARRIVALS_DAYS = 30;

/** Real sold count from orders in the last 24 hours. */
export async function getSoldToday(productId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const result = await prisma.orderItem.aggregate({
    where: {
      productId,
      order: { createdAt: { gte: since } },
    },
    _sum: { quantity: true },
  });
  return result._sum.quantity ?? 0;
}

/**
 * Deterministic pseudo-random "currently viewing" count.
 * Uses productId + 5-minute time window so it is stable per render
 * and changes slowly — no real-time infra needed.
 */
export function getViewingCount(productId: string): number {
  const window = Math.floor(Date.now() / (5 * 60 * 1000));
  let hash = 0;
  const seed = productId + window;
  for (let i = 0; i < seed.length; i++) {
    hash = (Math.imul(31, hash) + seed.charCodeAt(i)) | 0;
  }
  return 3 + (Math.abs(hash) % 18); // 3–20
}

export type SocialProofData = {
  soldToday: number;
  viewing: number;
  isTrending: boolean;
  isNew: boolean;
};

export async function getSocialProof(
  productId: string,
  createdAt?: Date | string | null,
): Promise<SocialProofData> {
  const soldToday = await getSoldToday(productId);
  const viewing = getViewingCount(productId);
  const isTrending = soldToday >= TRENDING_THRESHOLD;
  const isNew = createdAt
    ? Date.now() - new Date(createdAt).getTime() < NEW_ARRIVALS_DAYS * 86_400_000
    : false;
  return { soldToday, viewing, isTrending, isNew };
}
