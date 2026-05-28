import { AutomationEventType } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { getSiteUrl } from '@/lib/seo/site';

import { dispatchAutomation } from './dispatch';

/**
 * Cart abandonment scan.
 *
 * "Abandoned" = cart with items, last updated between 30 minutes and
 * 24 hours ago. The 24h ceiling avoids reminding stale carts forever
 * (a customer who abandoned 3 days ago is gone — sending a nudge then
 * is spam, not marketing). Idempotency is enforced via dedupeKey:
 * `CART_ABANDONED:<cartId>:<windowStart>` so the same cart won't
 * receive multiple reminders even if the cron runs every minute.
 *
 * Returns counts for observability.
 */

const ABANDON_AFTER_MIN = 30;
const ABANDON_BEFORE_MIN = 24 * 60;

export async function runCartAbandonmentScan(): Promise<{
  scanned: number;
  dispatched: number;
}> {
  const now = Date.now();
  const oldest = new Date(now - ABANDON_BEFORE_MIN * 60 * 1000);
  const newest = new Date(now - ABANDON_AFTER_MIN * 60 * 1000);

  const carts = await prisma.cart.findMany({
    where: {
      updatedAt: { gte: oldest, lte: newest },
      items: { some: {} }
    },
    take: 200,
    include: {
      user: { select: { id: true, name: true, email: true } },
      items: {
        take: 1,
        include: {
          product: {
            select: {
              title: true,
              slug: true,
              price: true,
              currency: true
            }
          }
        }
      }
    }
  });

  let dispatched = 0;
  const base = getSiteUrl();

  for (const cart of carts) {
    if (!cart.user?.email) continue;
    const item = cart.items[0];
    if (!item) continue;

    // One reminder per cart per "abandonment window" — if the user
    // updates the cart, `updatedAt` shifts and a new dedupeKey emerges.
    const dedupeKey = `CART_ABANDONED:${cart.id}:${cart.updatedAt.toISOString().slice(0, 13)}`;

    await dispatchAutomation({
      eventType: AutomationEventType.CART_ABANDONED,
      userId: cart.user.id,
      dedupeKey,
      email: cart.user.email,
      vars: {
        name: cart.user.name,
        product: item.product.title,
        price: `${Number(item.product.price).toFixed(2)} ${item.product.currency ?? 'USD'}`,
        link: `${base}/en/cart`
      }
    });
    dispatched++;
  }

  return { scanned: carts.length, dispatched };
}
