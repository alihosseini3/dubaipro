/**
 * Pure helpers for volume-pricing tiers. No I/O — imported by the service
 * and unit tests. (The legacy `tierPricing` Json parser lived here until the
 * Phase-7 column drop.)
 */

export type TierInput = {
  currency: string;
  minQty: number;
  /** Null = "and above" — only allowed on the last tier of its currency. */
  maxQty: number | null;
  unitPrice: number;
  leadTimeDays: number | null;
};

export type TierValidation = { ok: true } | { ok: false; reason: string };

/**
 * Cross-field rules for a tier set (validated per currency):
 *   - minQty strictly increasing, no duplicate boundaries
 *   - ranges must not overlap (previous maxQty < next minQty)
 *   - an open-ended tier (maxQty = null) may only be the last one
 */
export function validateTierSet(tiers: readonly TierInput[]): TierValidation {
  const byCurrency = new Map<string, TierInput[]>();
  for (const tier of tiers) {
    const list = byCurrency.get(tier.currency) ?? [];
    list.push(tier);
    byCurrency.set(tier.currency, list);
  }

  for (const [currency, list] of byCurrency) {
    const sorted = [...list].sort((a, b) => a.minQty - b.minQty);
    for (let i = 0; i < sorted.length; i++) {
      const tier = sorted[i];
      if (tier.maxQty !== null && tier.maxQty < tier.minQty) {
        return { ok: false, reason: `${currency}: maxQty below minQty` };
      }
      if (i > 0) {
        const prev = sorted[i - 1];
        if (tier.minQty === prev.minQty) {
          return { ok: false, reason: `${currency}: duplicate minQty ${tier.minQty}` };
        }
        if (prev.maxQty === null) {
          return { ok: false, reason: `${currency}: open-ended tier must be last` };
        }
        if (prev.maxQty >= tier.minQty) {
          return {
            ok: false,
            reason: `${currency}: tiers overlap at qty ${tier.minQty}`
          };
        }
      }
    }
  }
  return { ok: true };
}
