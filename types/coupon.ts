/**
 * Coupon DTOs shared between the service layer, API routes, and UI.
 *
 * `Coupon` is the domain object exposed to admin views; the cart/checkout
 * UI only ever sees `AppliedCouponDTO`, a minimal snapshot that cannot be
 * used to reverse-engineer private admin fields (usageLimit, usedCount).
 */

export type CouponType = 'PERCENTAGE' | 'FIXED';

export type CouponAppliesTo = 'ALL' | 'CATEGORY' | 'PRODUCT' | 'USER';

/** Minimal shape shown on cart/checkout when a coupon is active. */
export type AppliedCouponDTO = {
  id: string;
  code: string;
  type: CouponType;
  /** Numeric value: percent (0-100) for PERCENTAGE, absolute amount for FIXED. */
  value: number;
  /** Resolved monetary discount against the current subtotal, rounded to 2dp. */
  discountAmount: number;
};

/** Full admin-side DTO. */
export type CouponDTO = {
  id: string;
  code: string;
  description: string | null;
  type: CouponType;
  value: number;
  minOrderAmount: number | null;
  maxDiscount: number | null;
  usageLimit: number | null;
  usedCount: number;
  expiresAt: string | null; // ISO
  isActive: boolean;
  appliesTo: CouponAppliesTo;
  categoryId: string | null;
  productId: string | null;
  userId: string | null;
  firstOrderOnly: boolean;
  perUserLimit: number | null;
  startAt: string | null; // ISO
  autoApply: boolean;
  createdAt: string; // ISO
};

/** Per-coupon analytics shown in the admin detail view. */
export type CouponStatsDTO = {
  totalUsage: number;
  /** Sum of `Order.discountAmount` rows where couponId = X. */
  revenueImpact: number;
  /** Distinct users who redeemed at least once. */
  uniqueUsers: number;
};

/** Single redemption row used by admin history view. */
export type CouponUsageDTO = {
  id: string;
  orderId: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  discountAmount: number;
  orderTotal: number;
  usedAt: string; // ISO
};

/** Input for create/update (admin). */
export type CouponInput = {
  code: string;
  description?: string | null;
  type: CouponType;
  value: number;
  minOrderAmount?: number | null;
  maxDiscount?: number | null;
  usageLimit?: number | null;
  expiresAt?: string | null;
  isActive?: boolean;
  appliesTo?: CouponAppliesTo;
  categoryId?: string | null;
  productId?: string | null;
  userId?: string | null;
  firstOrderOnly?: boolean;
  perUserLimit?: number | null;
  startAt?: string | null;
  autoApply?: boolean;
};

/**
 * Validation/business error codes. These are stable strings returned by the
 * API so the UI can map each case to a localized message.
 */
export type CouponErrorCode =
  | 'coupon_not_found'
  | 'coupon_inactive'
  | 'coupon_expired'
  | 'coupon_not_started'
  | 'coupon_usage_limit_reached'
  | 'coupon_per_user_limit_reached'
  | 'coupon_first_order_only'
  | 'coupon_not_for_user'
  | 'coupon_no_matching_items'
  | 'coupon_min_order_not_met'
  | 'coupon_code_taken'
  | 'coupon_invalid_value'
  | 'coupon_invalid_input'
  | 'cart_empty';
