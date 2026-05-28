import 'server-only';

import { OrderStatus, type Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import type { DateRange } from './types';

/**
 * Per-supplier analytics. Strictly scoped to the given `supplierId`:
 *
 * - Clicks:    `WhatsAppClick.supplierId = X` OR targeted at one of the
 *              supplier's products.
 * - Orders:    attributed via `Order.whatsappClickId` matching any of
 *              those clicks AND containing at least one item from this
 *              supplier.
 * - Revenue:   summed over `OrderItem.price * quantity` for items owned
 *              by this supplier only — multi-supplier orders are split
 *              pro-rata so no one gets credit for another's items.
 *
 * Callers MUST pass a `supplierId` already verified against the session
 * (see `requireSupplier`); this service does not re-authenticate.
 */
export type SupplierAnalyticsData = {
  range: {
    from: string;
    to: string;
    preset: DateRange['preset'];
  };
  totals: {
    clicks: number;
    attributedOrders: number;
    attributedRevenue: number;
    conversionRate: number;
  };
  byProduct: Array<{
    productId: string;
    slug: string | null;
    title: string | null;
    clicks: number;
  }>;
};

const REVENUE_STATUSES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED
];

export async function getSupplierAnalytics(
  supplierId: string,
  range: DateRange
): Promise<SupplierAnalyticsData> {
  const { from, to } = range;
  const now = new Date();

  // 1. Resolve this supplier's product ids once — reused by clicks +
  //    order-items scoping below.
  const ownProducts = await prisma.product.findMany({
    where: { supplierId },
    select: { id: true, slug: true, title: true }
  });
  const ownProductIds = ownProducts.map((p) => p.id);

  const waWhere: Prisma.WhatsAppClickWhereInput = {
    createdAt: { gte: from, lt: to },
    // Dedup: expired clicks are ignored — matches the admin dashboard.
    AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
    OR: [
      { supplierId },
      ...(ownProductIds.length ? [{ productId: { in: ownProductIds } }] : [])
    ]
  };

  // 2. Clicks + per-product click breakdown, in parallel.
  const [clickCount, clickRows, clickIdRows] = await Promise.all([
    prisma.whatsAppClick.count({ where: waWhere }),
    prisma.whatsAppClick.groupBy({
      by: ['productId'],
      where: {
        ...waWhere,
        productId: { in: ownProductIds.length ? ownProductIds : ['__none__'] }
      },
      _count: { _all: true },
      orderBy: { _count: { productId: 'desc' } },
      take: 10
    }),
    prisma.whatsAppClick.findMany({ where: waWhere, select: { id: true } })
  ]);

  const clickIds = clickIdRows.map((r) => r.id);

  // 3. Attributed orders + pro-rata revenue. Skip the roundtrip entirely
  //    when this supplier has no clicks in the window.
  let attributedOrders = 0;
  let attributedRevenue = 0;

  if (clickIds.length > 0 && ownProductIds.length > 0) {
    // `OrderItem.price * quantity` cannot be expressed as a SUM in Prisma,
    // so we pull only the attributed item rows (already narrowly filtered)
    // and sum in JS. A single Prisma roundtrip — no extra latency.
    const items = await prisma.orderItem.findMany({
      where: {
        order: {
          status: { in: REVENUE_STATUSES },
          createdAt: { gte: from, lt: to },
          whatsappClickId: { in: clickIds }
        },
        product: { supplierId }
      },
      select: { orderId: true, price: true, quantity: true }
    });

    const orderIds = new Set<string>();
    for (const it of items) {
      orderIds.add(it.orderId);
      attributedRevenue += Number(it.price) * it.quantity;
    }
    attributedOrders = orderIds.size;
  }

  const conversionRate = clickCount > 0 ? attributedOrders / clickCount : 0;

  const productLookup = new Map(ownProducts.map((p) => [p.id, p]));
  const byProduct = clickRows
    .filter((r): r is typeof r & { productId: string } => !!r.productId)
    .map((r) => {
      const meta = productLookup.get(r.productId);
      return {
        productId: r.productId,
        slug: meta?.slug ?? null,
        title: meta?.title ?? null,
        clicks: r._count._all
      };
    });

  return {
    range: {
      from: from.toISOString(),
      to: to.toISOString(),
      preset: range.preset
    },
    totals: {
      clicks: clickCount,
      attributedOrders,
      attributedRevenue,
      conversionRate
    },
    byProduct
  };
}
