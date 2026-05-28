/**
 * Statistical helpers for revenue-driven A/B decisions.
 *
 * We deliberately avoid pulling a stats library: a marketplace
 * experiment only needs a normal-approximation z-test, which is a few
 * lines of arithmetic and stays bundle-free.
 */

export type VariantStats = {
  variantId: string;
  variantKey: string;
  variantName: string;
  weight: number;
  config: unknown;
  /** Distinct visitors that saw this variant. Denominator for RPU/CVR. */
  visitors: number;
  impressions: number;
  clicks: number;
  conversions: number;
  /** Total revenue attributed to this variant. */
  revenue: number;
  /** Sum of value^2 across CONVERSION rows. Used to estimate variance. */
  revenueSq: number;
};

export type ComputedStats = VariantStats & {
  /** Conversion rate = conversions / visitors (0..1). */
  cvr: number;
  /** Click-through rate = clicks / impressions (0..1). */
  ctr: number;
  /** Average order value = revenue / conversions, or 0. */
  aov: number;
  /** Revenue per visitor (the headline money metric). */
  rpu: number;
  /** Sample variance of per-visitor revenue, used for the z-test. */
  rpuVariance: number;
};

/**
 * Per-visitor revenue variance, normal approximation.
 *
 * Visitors who didn't convert contribute (0 - rpu)^2 each; converters
 * contribute (value - rpu)^2 each. Expanding gives:
 *   variance = (sumSq - n * rpu^2) / (n - 1)
 * where sumSq is over the n visitors (zeros included).
 *
 * If n < 2 we return 0 — the caller treats zero variance as
 * "not enough data to declare a winner".
 */
function rpuVarianceFromSums(
  sumSq: number,
  rpu: number,
  visitors: number
): number {
  if (visitors < 2) return 0;
  const variance = (sumSq - visitors * rpu * rpu) / (visitors - 1);
  return variance > 0 ? variance : 0;
}

export function computeStats(raw: VariantStats): ComputedStats {
  const cvr = raw.visitors > 0 ? raw.conversions / raw.visitors : 0;
  const ctr = raw.impressions > 0 ? raw.clicks / raw.impressions : 0;
  const aov = raw.conversions > 0 ? raw.revenue / raw.conversions : 0;
  const rpu = raw.visitors > 0 ? raw.revenue / raw.visitors : 0;
  const rpuVariance = rpuVarianceFromSums(raw.revenueSq, rpu, raw.visitors);
  return { ...raw, cvr, ctr, aov, rpu, rpuVariance };
}

/**
 * Φ(z) — standard normal CDF approximation (Abramowitz & Stegun 26.2.17).
 * Plenty accurate for confidence intervals; max error ≈ 7.5e-8.
 */
function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t -
      0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

export type WinnerVerdict = {
  /** The challenger that beats the baseline by RPU. Null if tie / no data. */
  winnerId: string | null;
  /** Variant we compared against (chosen by lowest variant key, usually 'A'). */
  baselineId: string | null;
  /** Relative lift in RPU vs baseline, e.g. 0.23 = +23%. */
  liftPct: number;
  /** Two-sample z-score on revenue per visitor. */
  zScore: number;
  /** P(winner truly beats baseline). 0..1. */
  confidence: number;
  /** Human-friendly bucket. */
  confidenceLevel: 'insufficient' | 'low' | 'medium' | 'high';
  /** True when sample size + confidence cross the safety thresholds. */
  shouldApply: boolean;
  /** Smallest visitor count across variants — surfaced in the UI as a check. */
  minVisitors: number;
};

export const MIN_VISITORS_PER_VARIANT = 100;
const HIGH_CONFIDENCE = 0.95;
const MEDIUM_CONFIDENCE = 0.9;

/**
 * Pick the variant with the highest RPU and run a two-sample z-test
 * vs the baseline. Returns a verdict the UI uses for the winner badge,
 * insight copy, and the "Apply winner" CTA.
 */
export function evaluateWinner(stats: ComputedStats[]): WinnerVerdict {
  if (stats.length < 2) {
    return {
      winnerId: null,
      baselineId: stats[0]?.variantId ?? null,
      liftPct: 0,
      zScore: 0,
      confidence: 0,
      confidenceLevel: 'insufficient',
      shouldApply: false,
      minVisitors: stats[0]?.visitors ?? 0
    };
  }

  // Baseline = lowest variant key (alphabetic). Stable & predictable.
  const baseline = [...stats].sort((a, b) =>
    a.variantKey.localeCompare(b.variantKey)
  )[0];

  // Challenger = highest RPU among non-baseline variants. We optimize
  // for money, not clicks — that is the whole point of this upgrade.
  const challenger = stats
    .filter((s) => s.variantId !== baseline.variantId)
    .reduce((best, cur) => (cur.rpu > best.rpu ? cur : best));

  const minVisitors = Math.min(...stats.map((s) => s.visitors));

  const lift =
    baseline.rpu > 0 ? (challenger.rpu - baseline.rpu) / baseline.rpu : 0;

  // Two-sample z on RPU. If either variant has zero variance (e.g. no
  // conversions yet) we cannot estimate noise and refuse to call a winner.
  const seSquared =
    (challenger.rpuVariance / Math.max(challenger.visitors, 1)) +
    (baseline.rpuVariance / Math.max(baseline.visitors, 1));
  const se = Math.sqrt(seSquared);
  const zScore = se > 0 ? (challenger.rpu - baseline.rpu) / se : 0;
  const confidence = se > 0 ? normalCdf(Math.abs(zScore)) : 0;

  const enoughData = minVisitors >= MIN_VISITORS_PER_VARIANT && se > 0;

  let level: WinnerVerdict['confidenceLevel'] = 'insufficient';
  if (enoughData) {
    if (confidence >= HIGH_CONFIDENCE) level = 'high';
    else if (confidence >= MEDIUM_CONFIDENCE) level = 'medium';
    else level = 'low';
  }

  const shouldApply =
    enoughData && challenger.rpu > baseline.rpu && confidence >= HIGH_CONFIDENCE;

  return {
    winnerId: shouldApply ? challenger.variantId : null,
    baselineId: baseline.variantId,
    liftPct: lift,
    zScore,
    confidence,
    confidenceLevel: level,
    shouldApply,
    minVisitors
  };
}
