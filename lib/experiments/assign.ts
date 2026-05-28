/**
 * Deterministic, stateless variant assignment.
 *
 * Why hashing instead of storing assignments in DB:
 *   - No write on the read path (zero added latency on hot pages).
 *   - SSR-safe: same input → same output, so server and any later client
 *     re-hydration agree without negotiation.
 *   - Cookie loss is non-fatal: a fresh visitor id may land them in a
 *     different arm, but in aggregate the split holds.
 */

/** FNV-1a 32-bit. Plenty of entropy for bucketing; no crypto need here. */
function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export type AssignableVariant = {
  id: string;
  key: string;
  weight: number;
  config: unknown;
};

/**
 * Pick a variant for `visitorId` within `experimentKey`.
 * Returns null if there are no positively-weighted variants.
 */
export function pickVariant<V extends AssignableVariant>(
  variants: V[],
  visitorId: string,
  experimentKey: string
): V | null {
  const eligible = variants.filter((v) => v.weight > 0);
  if (eligible.length === 0) return null;

  const total = eligible.reduce((acc, v) => acc + v.weight, 0);
  // Modulo by `total` keeps the bucket boundaries proportional to weights.
  const bucket = fnv1a(`${visitorId}:${experimentKey}`) % total;

  let acc = 0;
  for (const v of eligible) {
    acc += v.weight;
    if (bucket < acc) return v;
  }
  return eligible[eligible.length - 1];
}
