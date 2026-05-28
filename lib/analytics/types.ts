/**
 * Analytics DTOs — exchanged between `@/lib/analytics/service` (server) and
 * the admin dashboard UI. Every monetary amount is expressed in AED, the
 * storefront's canonical base currency. The UI layer is responsible for
 * converting these to the viewer's display currency via `@/lib/currency`.
 *
 * All time-series buckets use ISO-8601 calendar dates (`YYYY-MM-DD`) in UTC
 * so they serialise cleanly across the wire and are comparable regardless
 * of the admin's time zone.
 */

/** Canonical preset labels for the date-range filter. */
export type RangePreset = 'today' | '7d' | '30d' | 'custom';

/** Normalised, server-side view of a requested date window. */
export type DateRange = {
  /** Inclusive start of the window (00:00:00.000 UTC of that day). */
  from: Date;
  /** Exclusive end of the window (00:00:00.000 UTC of the day AFTER). */
  to: Date;
  /** The preset that produced this range (`'custom'` when free-form). */
  preset: RangePreset;
};

/** One calendar-day slice of a time series. */
export type TimeBucket = {
  /** ISO date, e.g. `"2026-04-22"`. */
  date: string;
  /** Value for this day (AED when monetary, integer when count). */
  value: number;
};

/** One row of the "top products" leaderboard. */
export type TopProduct = {
  productId: string;
  slug: string;
  title: string;
  imageUrl: string | null;
  /** Total revenue attributed to this product in the window, in AED. */
  revenue: number;
  /** Total units sold in the window. */
  unitsSold: number;
};

/** One row of the "WhatsApp clicks by product" leaderboard. */
export type WhatsAppClicksByProduct = {
  productId: string;
  slug: string | null;
  title: string | null;
  clicks: number;
};

/** One row of the "WhatsApp clicks by supplier" leaderboard. */
export type WhatsAppClicksBySupplier = {
  supplierId: string;
  name: string | null;
  clicks: number;
};

/** One row of the "WhatsApp clicks by campaign" leaderboard. */
export type WhatsAppClicksByCampaign = {
  /** utm_campaign value. */
  campaign: string;
  /** utm_source grouping key (may be empty). */
  source: string;
  /** utm_medium grouping key (may be empty). */
  medium: string;
  clicks: number;
};

/** WhatsApp click analytics aggregate. */
export type WhatsAppAnalytics = {
  /** Total clicks in the window (across all sources). */
  total: number;
  /** Orders attributed to a WhatsApp click (revenue-tier statuses only). */
  attributedOrders: number;
  /** Revenue (AED) attributed to WhatsApp clicks. */
  attributedRevenue: number;
  /** `attributedOrders / total` (0 when no clicks). */
  conversionRate: number;
  /** Top products by click count (capped at 10). */
  byProduct: WhatsAppClicksByProduct[];
  /** Top suppliers by click count (capped at 10). */
  bySupplier: WhatsAppClicksBySupplier[];
  /** Top campaigns by click count (capped at 10). */
  byCampaign: WhatsAppClicksByCampaign[];
  /** UTM filter actually applied to the aggregate (echo for the UI). */
  filter: {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
  };
};

/** One row of the "top coupons" leaderboard. */
export type TopCoupon = {
  /** Upper-cased code snapshot stored on the order. */
  code: string;
  /** Number of orders that used this code in the window. */
  uses: number;
  /** Sum of `Order.discountAmount` attributed to this code, in AED. */
  totalDiscount: number;
};

/** The full analytics payload returned by `getAnalytics`. */
export type AnalyticsData = {
  range: {
    from: string; // ISO datetime
    to: string; // ISO datetime
    preset: RangePreset;
  };
  totals: {
    /** Sum of `Order.totalPrice` for non-cancelled paid-tier orders, AED. */
    revenue: number;
    /** Count of paid-tier orders. */
    orders: number;
    /** `revenue / orders` (0 when orders == 0), AED. */
    averageOrderValue: number;
    /** Distinct customer ids that placed at least one paid-tier order. */
    customers: number;
    /** Count of paid-tier orders that used a coupon. */
    couponsUsed: number;
  };
  revenueByDay: TimeBucket[];
  ordersByDay: TimeBucket[];
  topProducts: TopProduct[];
  topCoupons: TopCoupon[];
  whatsapp: WhatsAppAnalytics;
};
