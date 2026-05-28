import 'server-only';

import { getActiveVariant } from './server';

/**
 * Pricing experiments.
 *
 * Convention: one well-known experiment with key `PRICING_EXPERIMENT_KEY`
 * governs every product-pricing test on the site. Each variant.config
 * is a `PricingVariantConfig` (validated loosely at read time so a
 * malformed admin entry never crashes the storefront).
 *
 * Three levers, evaluated in this order:
 *
 *   1. `priceOverride[productId]` — exact price for a specific product.
 *   2. `bundle` includes productId AND `discountPercent` set →
 *      variant price = base * (1 - discountPercent/100).
 *   3. `discountPercent` only → applies to every product the user
 *      sees while in this variant.
 *
 * Returning `null` means "no experiment is active for this visitor /
 * this product"; callers should display the base price.
 *
 * Critical invariants:
 *   - The function is pure given (productId, basePrice, visitor) —
 *     same inputs → same output, which keeps SSR + future client
 *     re-renders in agreement (no flicker).
 *   - We NEVER mutate the upstream `Product.price`. Storage of the
 *     transacted amount on `Order` happens at checkout time using
 *     whatever this function returned.
 */

export const PRICING_EXPERIMENT_KEY = 'product_pricing';

export type PricingVariantConfig = {
  /** Map of productId → absolute price in product currency. */
  priceOverride?: Record<string, number>;
  /** Product ids that are part of a bundle this variant promotes. */
  bundle?: string[];
  /** 0..100. Applied to base or bundle products. */
  discountPercent?: number;
};

export type ResolvedPrice = {
  productId: string;
  /** What we'll charge / show. */
  shownPrice: number;
  /** The catalog price before any experiment took effect. */
  originalPrice: number;
  /** True if this differs from `originalPrice` (i.e. variant won). */
  experimentApplied: boolean;
  /** When applied, the experiment + variant ids for tracking + audit. */
  experimentId: string | null;
  variantId: string | null;
  /** Which lever fired. */
  source: 'base' | 'override' | 'bundle' | 'percent';
};

function readConfig(raw: unknown): PricingVariantConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const cfg = raw as Record<string, unknown>;
  const out: PricingVariantConfig = {};

  if (cfg.priceOverride && typeof cfg.priceOverride === 'object' && !Array.isArray(cfg.priceOverride)) {
    const map: Record<string, number> = {};
    for (const [k, v] of Object.entries(cfg.priceOverride as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) map[k] = v;
    }
    if (Object.keys(map).length > 0) out.priceOverride = map;
  }
  if (Array.isArray(cfg.bundle)) {
    out.bundle = cfg.bundle.filter((x): x is string => typeof x === 'string');
  }
  if (typeof cfg.discountPercent === 'number' && cfg.discountPercent >= 0 && cfg.discountPercent <= 100) {
    out.discountPercent = cfg.discountPercent;
  }
  return out;
}

/**
 * Resolve the price to charge for `productId`. Logs the (original,
 * shown) pair for audit when an experiment is active, so analysts can
 * reconcile reported revenue with catalog totals.
 */
export async function resolveProductPrice(
  productId: string,
  basePrice: number
): Promise<ResolvedPrice> {
  const fallback: ResolvedPrice = {
    productId,
    shownPrice: basePrice,
    originalPrice: basePrice,
    experimentApplied: false,
    experimentId: null,
    variantId: null,
    source: 'base'
  };

  const variant = await getActiveVariant(PRICING_EXPERIMENT_KEY);
  if (!variant) return fallback;

  const cfg = readConfig(variant.config);

  let shown = basePrice;
  let source: ResolvedPrice['source'] = 'base';

  if (cfg.priceOverride && cfg.priceOverride[productId] !== undefined) {
    shown = cfg.priceOverride[productId];
    source = 'override';
  } else if (
    cfg.bundle?.includes(productId) &&
    typeof cfg.discountPercent === 'number'
  ) {
    shown = round2(basePrice * (1 - cfg.discountPercent / 100));
    source = 'bundle';
  } else if (typeof cfg.discountPercent === 'number') {
    shown = round2(basePrice * (1 - cfg.discountPercent / 100));
    source = 'percent';
  }

  // Refuse pathological inputs — would otherwise produce negative
  // revenue and confuse downstream stats.
  if (!Number.isFinite(shown) || shown < 0) shown = basePrice;

  const applied = shown !== basePrice;
  if (applied) {
    // Structured log line — picked up by any log aggregator. Cheap
    // (one console call per server-rendered product card).
    console.info(
      JSON.stringify({
        evt: 'pricing_experiment_applied',
        productId,
        originalPrice: basePrice,
        shownPrice: shown,
        experimentId: variant.experimentId,
        variantId: variant.variantId,
        variantKey: variant.variantKey,
        source
      })
    );
  }

  return {
    productId,
    shownPrice: shown,
    originalPrice: basePrice,
    experimentApplied: applied,
    experimentId: variant.experimentId,
    variantId: variant.variantId,
    source
  };
}

/**
 * Bulk variant of `resolveProductPrice` for cart / checkout. Resolves
 * the variant ONCE then maps each item, so we don't pay the DB hit
 * per line. Order of items is preserved.
 */
export async function resolveCartPrices(
  items: Array<{ productId: string; basePrice: number; quantity: number }>
): Promise<{
  items: Array<ResolvedPrice & { quantity: number; lineTotal: number }>;
  originalTotal: number;
  shownTotal: number;
  experimentId: string | null;
  variantId: string | null;
}> {
  const variant = await getActiveVariant(PRICING_EXPERIMENT_KEY);
  const cfg = variant ? readConfig(variant.config) : null;

  const out = items.map((it) => {
    let shown = it.basePrice;
    let source: ResolvedPrice['source'] = 'base';
    if (cfg) {
      if (cfg.priceOverride && cfg.priceOverride[it.productId] !== undefined) {
        shown = cfg.priceOverride[it.productId];
        source = 'override';
      } else if (
        cfg.bundle?.includes(it.productId) &&
        typeof cfg.discountPercent === 'number'
      ) {
        shown = round2(it.basePrice * (1 - cfg.discountPercent / 100));
        source = 'bundle';
      } else if (typeof cfg.discountPercent === 'number') {
        shown = round2(it.basePrice * (1 - cfg.discountPercent / 100));
        source = 'percent';
      }
    }
    if (!Number.isFinite(shown) || shown < 0) shown = it.basePrice;
    const applied = shown !== it.basePrice;
    return {
      productId: it.productId,
      shownPrice: shown,
      originalPrice: it.basePrice,
      experimentApplied: applied,
      experimentId: variant?.experimentId ?? null,
      variantId: variant?.variantId ?? null,
      source,
      quantity: it.quantity,
      lineTotal: round2(shown * it.quantity)
    };
  });

  return {
    items: out,
    originalTotal: round2(out.reduce((a, x) => a + x.originalPrice * x.quantity, 0)),
    shownTotal: round2(out.reduce((a, x) => a + x.lineTotal, 0)),
    experimentId: variant?.experimentId ?? null,
    variantId: variant?.variantId ?? null
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
