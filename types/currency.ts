/**
 * Currency primitives for the display layer.
 *
 * Invariants that must always hold:
 *   1. All monetary values in the database are persisted in `BASE_CURRENCY` (AED).
 *   2. Orders, payments, cart totals, and coupon math are AED-only.
 *   3. This module is only used to convert + format prices at render time.
 *   4. User never picks a currency; it's derived from the active locale.
 *      (future: allow an explicit override persisted on User)
 */

export const SUPPORTED_CURRENCIES = ['AED', 'USD', 'IRR'] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export const BASE_CURRENCY: Currency = 'AED';

/**
 * Serializable snapshot passed from a Server Component to any Client
 * Component that needs to format prices. Keep this shape small and stable —
 * it may be cached or baked into HTML.
 */
export type DisplayCurrency = {
  /** Target currency for display (derived from the user's locale). */
  code: Currency;
  /** UI locale, used by `Intl.NumberFormat`. */
  locale: string;
  /**
   * Multiplier that converts an AED amount to `code`.
   * `amount_in_display = amount_in_AED * rateFromAED`.
   */
  rateFromAED: number;
};

/**
 * DTO returned by admin APIs and used by the settings form.
 */
export type CurrencyRateDTO = {
  code: Currency;
  rate: number;
  /** ISO timestamp (null when using the static default). */
  updatedAt: string | null;
  /** `true` when the value comes from the static defaults, not the DB. */
  isDefault: boolean;
};

export type CurrencyRatesUpdateInput = {
  rates: Partial<Record<Currency, number>>;
};
