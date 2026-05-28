import type { AppliedCouponDTO } from './coupon';

export type CartItemDTO = {
  id: string;
  productId: string;
  quantity: number;
  product: {
    id: string;
    title: string;
    slug: string;
    price: string | number;
    currency: string;
    stock: number;
    imageUrl: string | null;
  };
  /** Pre-computed server-side: price * quantity. */
  lineTotal: number;
};

export type CartDTO = {
  id: string;
  items: CartItemDTO[];
  /** Sum of line totals before any discount. */
  subtotal: number;
  itemCount: number;
  currency: string;
  /**
   * Currently applied coupon, if any. The cart service auto-clears the
   * coupon when it becomes invalid for the current subtotal — so if this
   * is present, the discount is guaranteed to be applicable right now.
   */
  coupon: AppliedCouponDTO | null;
  /** Monetary discount (>=0). Always zero when `coupon` is null. */
  discount: number;
  /** Cart total = `subtotal - discount` (shipping is added at checkout). */
  total: number;
};
