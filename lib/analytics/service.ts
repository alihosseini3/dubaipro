import 'server-only';

import { OrderStatus, Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import type {
  AnalyticsData,
  DateRange,
  RangePreset,
  TimeBucket,
  TopCoupon,
  TopProduct
} from './types';

/**
 * Order statuses that contribute to revenue.
 *
 * We explicitly exclude `PENDING` (checkout started but never paid) and
 * `CANCELLED` (refunded / abandoned). Everything from `PAID` onward counts
 * — once money has moved, revenue is recognised even if the order later
 * moves through fulfilment states.
 *
 * If the business later wants "recognised only on delivery" accounting,
 * flip this to `[DELIVERED]` — all downstream aggregates adapt automatically.
 */
const REVENUE_STATUSES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED
];

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Truncate a `Date` to midnight UTC of the same calendar day. */
function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
}

/** ISO calendar date (YYYY-MM-DD) in UTC. */
function toIsoDate(d: Date): string {
  return startOfUtcDay(d).toISOString().slice(0, 10);
}

/**
 * Parse a range request into a validated `[from, to)` window. Any invalid
 * or missing input collapses gracefully to the "last 7 days" preset — the
 * dashboard should never error out because of bad query params.
 */
export function parseRange(input: {
  preset?: string | null;
  from?: string | null;
  to?: string | null;
}): DateRange {
  const preset = (input.preset ?? '7d') as RangePreset;
  const now = new Date();
  const todayStart = startOfUtcDay(now);
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 3_600_000);

  switch (preset) {
    case 'today':
      return { from: todayStart, to: tomorrowStart, preset: 'today' };
    case '30d':
      return {
        from: new Date(todayStart.getTime() - 29 * 24 * 3_600_000),
        to: tomorrowStart,
        preset: '30d'
      };
    case 'custom': {
      const from = input.from ? new Date(input.from) : null;
      const to = input.to ? new Date(input.to) : null;
      if (
        from &&
        to &&
        !Number.isNaN(from.getTime()) &&
        !Number.isNaN(to.getTime()) &&
        from < to
      ) {
        // Normalise to whole-day boundaries so buckets line up.
        return {
          from: startOfUtcDay(from),
          to: new Date(startOfUtcDay(to).getTime() + 24 * 3_600_000),
          preset: 'custom'
        };
      }
      // Fall through to default when custom is malformed.
      break;
    }
    case '7d':
    default:
      break;
  }

  return {
    from: new Date(todayStart.getTime() - 6 * 24 * 3_600_000),
    to: tomorrowStart,
    preset: preset === 'custom' ? '7d' : '7d'
  };
}

/**
 * Enumerate every calendar day in `[from, to)` as ISO strings. The service
 * layer needs this to zero-fill gaps where no orders were placed — charts
 * must render a continuous x-axis, not skip days.
 */
function enumerateDays(from: Date, to: Date): string[] {
  const out: string[] = [];
  let cur = startOfUtcDay(from).getTime();
  const end = startOfUtcDay(to).getTime();
  while (cur < end) {
    out.push(toIsoDate(new Date(cur)));
    cur += 24 * 3_600_000;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Core aggregation
// ---------------------------------------------------------------------------

/**
 * Produce the full analytics payload for the given range.
 *
 * **All monetary values returned are AED** — the storefront's base currency.
 * Conversion to the admin's display currency happens only in the UI layer.
 * Never bake FX into this function: doing so would silently distort totals
 * whenever a rate is edited.
 */
export type WhatsAppFilter = {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
};

function sanitizeUtmValue(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const v = raw.trim().toLowerCase().slice(0, 64);
  if (!v) return undefined;
  if (!/^[a-z0-9_.\-\s]+$/i.test(v)) return undefined;
  return v;
}

export async function getAnalytics(
  range: DateRange,
  waFilter: WhatsAppFilter = {}
): Promise<AnalyticsData> {
  const { from, to } = range;

  // Only WhatsApp click queries respect the UTM filter; revenue/orders are
  // order-pipeline KPIs and should remain unaffected.
  const waUtmSource = sanitizeUtmValue(waFilter.utmSource);
  const waUtmMedium = sanitizeUtmValue(waFilter.utmMedium);
  const waUtmCampaign = sanitizeUtmValue(waFilter.utmCampaign);
  // Exclude expired clicks from all WA aggregates. Legacy rows without an
  // `expiresAt` (NULL) are always kept — treating them as non-expiring
  // preserves historical analytics across the migration boundary.
  const now = new Date();
  const waBase: Prisma.WhatsAppClickWhereInput = {
    createdAt: { gte: from, lt: to },
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    ...(waUtmSource ? { utmSource: waUtmSource } : {}),
    ...(waUtmMedium ? { utmMedium: waUtmMedium } : {}),
    ...(waUtmCampaign ? { utmCampaign: waUtmCampaign } : {})
  };

  const baseWhere: Prisma.OrderWhereInput = {
    status: { in: REVENUE_STATUSES },
    createdAt: { gte: from, lt: to }
  };

  // Run independent queries in parallel — Prisma pools connections, and none
  // of these depend on the results of the others.
  const [
    totalsAgg,
    distinctCustomers,
    couponsUsed,
    ordersInRange,
    topProductRows,
    topCouponRows,
    whatsappTotal,
    whatsappByProductRows,
    whatsappBySupplierRows,
    whatsappByCampaignRows
  ] = await Promise.all([
    prisma.order.aggregate({
      where: baseWhere,
      _sum: { totalPrice: true },
      _count: { _all: true }
    }),
    // Distinct customer count — Prisma's `distinct` on groupBy gives us this
    // without loading rows into memory.
    prisma.order.findMany({
      where: baseWhere,
      distinct: ['userId'],
      select: { userId: true }
    }),
    prisma.order.count({
      where: { ...baseWhere, couponCode: { not: null } }
    }),
    // Raw orders for per-day bucketing. We fetch only the columns we need
    // to keep the payload small even over a 30-day window.
    prisma.order.findMany({
      where: baseWhere,
      select: { createdAt: true, totalPrice: true }
    }),
    prisma.orderItem.groupBy({
      by: ['productId'],
      where: { order: baseWhere },
      _sum: { quantity: true },
      _count: { _all: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 10
    }),
    prisma.order.groupBy({
      by: ['couponCode'],
      where: { ...baseWhere, couponCode: { not: null } },
      _count: { _all: true },
      _sum: { discountAmount: true },
      orderBy: { _count: { couponCode: 'desc' } },
      take: 10
    }),
    // WhatsApp click metrics — independent of the order pipeline; use the
    // same time window and any active UTM filter so every chart is coherent.
    prisma.whatsAppClick.count({ where: waBase }),
    prisma.whatsAppClick.groupBy({
      by: ['productId'],
      where: { ...waBase, productId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { productId: 'desc' } },
      take: 10
    }),
    prisma.whatsAppClick.groupBy({
      by: ['supplierId'],
      where: { ...waBase, supplierId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { supplierId: 'desc' } },
      take: 10
    }),
    prisma.whatsAppClick.groupBy({
      by: ['utmCampaign', 'utmSource', 'utmMedium'],
      where: { ...waBase, utmCampaign: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { utmCampaign: 'desc' } },
      take: 10
    })
  ]);

  // ---- Totals -------------------------------------------------------------
  const revenue = Number(totalsAgg._sum.totalPrice ?? 0);
  const orders = totalsAgg._count._all;
  const customers = distinctCustomers.length;
  const averageOrderValue = orders > 0 ? revenue / orders : 0;

  // ---- Time series (zero-filled) -----------------------------------------
  const allDays = enumerateDays(from, to);
  const revMap = new Map<string, number>(allDays.map((d) => [d, 0]));
  const ordMap = new Map<string, number>(allDays.map((d) => [d, 0]));
  for (const o of ordersInRange) {
    const key = toIsoDate(o.createdAt);
    revMap.set(key, (revMap.get(key) ?? 0) + Number(o.totalPrice));
    ordMap.set(key, (ordMap.get(key) ?? 0) + 1);
  }
  const revenueByDay: TimeBucket[] = allDays.map((d) => ({
    date: d,
    value: revMap.get(d) ?? 0
  }));
  const ordersByDay: TimeBucket[] = allDays.map((d) => ({
    date: d,
    value: ordMap.get(d) ?? 0
  }));

  // ---- Top products -------------------------------------------------------
  // For revenue-weighted ranking we compute in JS across the small top-10
  // candidate set. This avoids a second pass of `SUM(price * quantity)` which
  // isn't expressible via Prisma's typed groupBy.
  const productIds = topProductRows.map((r) => r.productId);
  const [productMeta, revenueByProduct] = await Promise.all([
    productIds.length === 0
      ? Promise.resolve([])
      : prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, slug: true, title: true, imageUrl: true }
        }),
    productIds.length === 0
      ? Promise.resolve([] as Array<{ productId: string; revenue: number }>)
      : prisma.orderItem
          .findMany({
            where: {
              order: baseWhere,
              productId: { in: productIds }
            },
            select: { productId: true, price: true, quantity: true }
          })
          .then((items) => {
            const m = new Map<string, number>();
            for (const it of items) {
              m.set(
                it.productId,
                (m.get(it.productId) ?? 0) +
                  Number(it.price) * it.quantity
              );
            }
            return Array.from(m.entries()).map(([productId, revenue]) => ({
              productId,
              revenue
            }));
          })
  ]);

  const revLookup = new Map(
    revenueByProduct.map((r) => [r.productId, r.revenue])
  );
  const metaLookup = new Map(productMeta.map((p) => [p.id, p]));

  const topProducts: TopProduct[] = topProductRows
    .map((row) => {
      const meta = metaLookup.get(row.productId);
      if (!meta) return null;
      return {
        productId: row.productId,
        slug: meta.slug,
        title: meta.title,
        imageUrl: meta.imageUrl,
        unitsSold: row._sum.quantity ?? 0,
        revenue: revLookup.get(row.productId) ?? 0
      } satisfies TopProduct;
    })
    .filter((x): x is TopProduct => x !== null)
    // Re-sort by revenue (primary KPI) now that we have the real numbers.
    .sort((a, b) => b.revenue - a.revenue);

  // ---- WhatsApp click metrics --------------------------------------------
  const waProductIds = whatsappByProductRows
    .map((r) => r.productId)
    .filter((id): id is string => !!id);
  const waSupplierIds = whatsappBySupplierRows
    .map((r) => r.supplierId)
    .filter((id): id is string => !!id);

  const [waProductMeta, waSupplierMeta] = await Promise.all([
    waProductIds.length === 0
      ? Promise.resolve([] as Array<{ id: string; slug: string; title: string }>)
      : prisma.product.findMany({
          where: { id: { in: waProductIds } },
          select: { id: true, slug: true, title: true }
        }),
    waSupplierIds.length === 0
      ? Promise.resolve([] as Array<{ id: string; name: string }>)
      : prisma.supplier.findMany({
          where: { id: { in: waSupplierIds } },
          select: { id: true, name: true }
        })
  ]);

  const waProductLookup = new Map(waProductMeta.map((p) => [p.id, p]));
  const waSupplierLookup = new Map(waSupplierMeta.map((s) => [s.id, s]));

  const whatsappByProduct = whatsappByProductRows
    .filter((r): r is typeof r & { productId: string } => !!r.productId)
    .map((r) => {
      const meta = waProductLookup.get(r.productId);
      return {
        productId: r.productId,
        slug: meta?.slug ?? null,
        title: meta?.title ?? null,
        clicks: r._count._all
      };
    });

  const whatsappBySupplier = whatsappBySupplierRows
    .filter((r): r is typeof r & { supplierId: string } => !!r.supplierId)
    .map((r) => {
      const meta = waSupplierLookup.get(r.supplierId);
      return {
        supplierId: r.supplierId,
        name: meta?.name ?? null,
        clicks: r._count._all
      };
    });

  const whatsappByCampaign = whatsappByCampaignRows
    .filter((r): r is typeof r & { utmCampaign: string } => !!r.utmCampaign)
    .map((r) => ({
      campaign: r.utmCampaign,
      source: r.utmSource ?? '',
      medium: r.utmMedium ?? '',
      clicks: r._count._all
    }));

  // ---- WhatsApp conversion (clicks → orders) -----------------------------
  // When a UTM filter is active, we must restrict attributed orders to the
  // click ids that match the filter — hence the pre-query. Without a
  // filter we can simply require `whatsappClickId` to be non-null.
  const hasUtmFilter = !!(waUtmSource || waUtmMedium || waUtmCampaign);
  let attributedClickIds: string[] | null = null;
  if (hasUtmFilter) {
    const rows = await prisma.whatsAppClick.findMany({
      where: waBase,
      select: { id: true }
    });
    attributedClickIds = rows.map((r) => r.id);
  }

  const attributedWhere: Prisma.OrderWhereInput = {
    ...baseWhere,
    whatsappClickId: attributedClickIds
      ? { in: attributedClickIds.length ? attributedClickIds : ['__none__'] }
      : { not: null }
  };

  const attributedAgg = await prisma.order.aggregate({
    where: attributedWhere,
    _sum: { totalPrice: true },
    _count: { _all: true }
  });
  const attributedOrders = attributedAgg._count._all;
  const attributedRevenue = Number(attributedAgg._sum.totalPrice ?? 0);
  const conversionRate =
    whatsappTotal > 0 ? attributedOrders / whatsappTotal : 0;

  // ---- Top coupons --------------------------------------------------------
  const topCoupons: TopCoupon[] = topCouponRows
    .filter((r): r is typeof r & { couponCode: string } => r.couponCode !== null)
    .map((r) => ({
      code: r.couponCode,
      uses: r._count._all,
      totalDiscount: Number(r._sum.discountAmount ?? 0)
    }));

  return {
    range: {
      from: from.toISOString(),
      to: to.toISOString(),
      preset: range.preset
    },
    totals: {
      revenue,
      orders,
      averageOrderValue,
      customers,
      couponsUsed
    },
    revenueByDay,
    ordersByDay,
    topProducts,
    topCoupons,
    whatsapp: {
      total: whatsappTotal,
      attributedOrders,
      attributedRevenue,
      conversionRate,
      byProduct: whatsappByProduct,
      bySupplier: whatsappBySupplier,
      byCampaign: whatsappByCampaign,
      filter: {
        utmSource: waUtmSource,
        utmMedium: waUtmMedium,
        utmCampaign: waUtmCampaign
      }
    }
  };
}
