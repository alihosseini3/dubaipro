/**
 * Low-Quality Image Placeholder (LQIP) generator.
 *
 * Produces a base64 data URL ~1-2KB that next/image can use as a
 * `placeholder="blur"` prop, plus an approximate dominant color in
 * `#RRGGBB` format for skeleton backgrounds.
 *
 * Both values are computed in a single Sharp pass where possible to
 * keep upload latency low.
 */

import sharp from 'sharp';

export interface BlurResult {
  /** `data:image/webp;base64,...` — small enough to inline in HTML. */
  blurDataURL: string;
  /** Approx average color, `#RRGGBB`. */
  dominantColor: string;
}

/** Convert one channel value (0-255) to two-digit hex. */
function toHex(byte: number): string {
  return byte.toString(16).padStart(2, '0');
}

/**
 * Compute LQIP + dominant color.
 *
 * - LQIP: 16px wide WebP @ quality 40 → tiny base64 string.
 * - Color: Sharp's built-in `stats()` returns per-channel averages;
 *   close enough to a true "dominant color" for skeleton tinting.
 */
export async function computeBlurAndColor(input: Buffer): Promise<BlurResult> {
  // Run blur and stats in parallel — they're independent pipelines.
  const [blurBuf, stats] = await Promise.all([
    sharp(input)
      .rotate()
      .resize(16, null, { fit: 'inside' })
      .webp({ quality: 40 })
      .toBuffer(),
    sharp(input).rotate().stats(),
  ]);

  const blurDataURL = `data:image/webp;base64,${blurBuf.toString('base64')}`;

  // `channels` is in source order; for RGB(A) images we want indexes 0/1/2.
  const c = stats.channels;
  const r = Math.round(c[0]?.mean ?? 200);
  const g = Math.round(c[1]?.mean ?? 200);
  const b = Math.round(c[2]?.mean ?? 200);

  const dominantColor = `#${toHex(r)}${toHex(g)}${toHex(b)}`;

  return { blurDataURL, dominantColor };
}

/** Safe fallback values when blur computation fails (non-fatal). */
export const BLUR_FALLBACK: BlurResult = {
  blurDataURL: '',
  dominantColor: '#e5e7eb',
};
