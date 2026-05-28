/**
 * Health & SEO score for a MediaAsset (0-100).
 *
 * The score is intentionally simple — admins want a glance signal,
 * not a forensic audit. Buckets:
 *
 *   alt text     +25
 *   keywords     +10
 *   modern format (webp or avif at master) +20
 *   responsive variants present              +15
 *   master ≤ 200 KB                          +20
 *   dimensions meet the context minimum      +10
 *
 * Total: 100. A score < 60 lights up the "needs attention" badge in
 * the gallery.
 */

import type { MediaScoreBreakdown } from './types';

export interface ScoreInput {
  alt?: string | null;
  keywords?: string[] | null;
  mimeType?: string | null;
  size?: number | null;
  width?: number | null;
  height?: number | null;
  variantCount?: number;
  /** True when the asset has at least one WebP or AVIF variant in storage */
  hasWebpVariant?: boolean;
  minWidth?: number;
  minHeight?: number;
}

const TARGET_BYTES = 200 * 1024;

export function computeMediaScore(input: ScoreInput): MediaScoreBreakdown {
  const hasAlt = input.alt && input.alt.trim().length >= 5 ? 25 : 0;

  const hasKeywords =
    Array.isArray(input.keywords) && input.keywords.length >= 2 ? 10 : 0;

  const masterIsModern =
    typeof input.mimeType === 'string' &&
    (input.mimeType === 'image/webp' || input.mimeType === 'image/avif');

  /* Award modern-format points if master is already webp/avif OR if a
   * converted webp variant exists in storage. */
  const isModernFormat = masterIsModern || input.hasWebpVariant ? 20 : 0;

  // ≥ 4 variants means we have at least the responsive ladder rendered.
  const hasResponsive = (input.variantCount ?? 0) >= 4 ? 15 : 0;

  const goodSize =
    typeof input.size === 'number' && input.size > 0 && input.size <= TARGET_BYTES
      ? 20
      : 0;

  const goodDimensions =
    typeof input.width === 'number' &&
    typeof input.height === 'number' &&
    input.width >= (input.minWidth ?? 0) &&
    input.height >= (input.minHeight ?? 0)
      ? 10
      : 0;

  const total =
    hasAlt + hasKeywords + isModernFormat + hasResponsive + goodSize + goodDimensions;

  return {
    total,
    hasAlt,
    hasKeywords,
    hasModernFormat: isModernFormat,
    hasResponsive,
    goodSize,
    goodDimensions,
  };
}
