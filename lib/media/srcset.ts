/**
 * srcSet / sizes string builders.
 *
 * Consumes the `variants` array from a `MediaAsset` DB row (or from the
 * `PipelineResult.variants`) to produce ready-to-use HTML attributes for
 * `<picture>` / `<img>` elements without any filesystem scanning.
 *
 * Usage:
 *   const src     = getVariantUrl(variants, 'original', 'webp') ?? asset.url;
 *   const srcSet  = buildSrcSet(variants, 'webp');
 *   const sizes   = buildSizes('product-cover');
 */

import type { MediaFormat, MediaPreset, RenderedVariant } from './types';

/* ─────────────────────────────────────────────────────────────────────────── */
/* Preset → viewport hint mapping (used by buildSizes)                         */
/* ─────────────────────────────────────────────────────────────────────────── */

/** Opinionated `sizes` attribute values keyed by context. */
const CONTEXT_SIZES: Record<string, string> = {
  'product-cover':   '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 600px',
  'product-gallery': '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 800px',
  'hero':            '100vw',
  'category':        '(max-width: 640px) 50vw, 250px',
  'brand':           '150px',
  'supplier':        '(max-width: 640px) 80px, 120px',
  'blog':            '(max-width: 768px) 100vw, 800px',
  'avatar':          '(max-width: 640px) 48px, 64px',
  'banner':          '100vw',
  'page':            '(max-width: 768px) 100vw, 1200px',
  'general':         '(max-width: 640px) 100vw, 50vw',
};

/* ─────────────────────────────────────────────────────────────────────────── */
/* Core builders                                                                */
/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * Build the `srcSet` attribute value for one format, sorted ascending by width.
 *
 *   webp-srcset: "/uploads/img-abc-thumb.webp 200w, /uploads/img-abc-small.webp 400w, ..."
 */
export function buildSrcSet(variants: RenderedVariant[], format: MediaFormat): string {
  return variants
    .filter((v) => v.format === format && v.width > 0)
    .sort((a, b) => a.width - b.width)
    .map((v) => `${v.url} ${v.width}w`)
    .join(', ');
}

/**
 * Build srcSet strings for ALL available formats.
 * Returns a map `{ webp: "...", avif: "..." }` — only formats present in variants.
 */
export function buildSrcSetMap(variants: RenderedVariant[]): Partial<Record<MediaFormat, string>> {
  const formats = [...new Set(variants.map((v) => v.format))] as MediaFormat[];
  const result: Partial<Record<MediaFormat, string>> = {};
  for (const fmt of formats) {
    const set = buildSrcSet(variants, fmt);
    if (set) result[fmt] = set;
  }
  return result;
}

/**
 * Get the URL for a specific preset + format combination.
 * Falls back through format preferences if the requested format is unavailable.
 */
export function getVariantUrl(
  variants: RenderedVariant[],
  preset: MediaPreset,
  preferredFormat: MediaFormat = 'webp',
): string | null {
  // Exact match
  const exact = variants.find((v) => v.preset === preset && v.format === preferredFormat);
  if (exact) return exact.url;

  // Same preset, any format (in preference order)
  const FORMAT_PREF: MediaFormat[] = ['avif', 'webp', 'jpeg', 'png'];
  for (const fmt of FORMAT_PREF) {
    const fallback = variants.find((v) => v.preset === preset && v.format === fmt);
    if (fallback) return fallback.url;
  }

  return null;
}

/**
 * Get the best variant URL for a given display width.
 * Selects the smallest variant that is ≥ targetWidth.
 */
export function getVariantUrlForWidth(
  variants: RenderedVariant[],
  targetWidth: number,
  preferredFormat: MediaFormat = 'webp',
): string | null {
  const byFormat = variants
    .filter((v) => v.format === preferredFormat)
    .sort((a, b) => a.width - b.width);

  const match = byFormat.find((v) => v.width >= targetWidth);
  return match?.url ?? byFormat[byFormat.length - 1]?.url ?? null;
}

/**
 * Build the `sizes` attribute from a context key or a custom string.
 *
 *   buildSizes('product-cover')  → "(max-width: 640px) 100vw, ..."
 *   buildSizes(undefined, '100vw') → "100vw"
 */
export function buildSizes(context?: string | null, fallback = '100vw'): string {
  if (context && context in CONTEXT_SIZES) return CONTEXT_SIZES[context];
  return fallback;
}

/**
 * Convenience: build everything needed for a <picture> element.
 *
 * @returns `{ src, srcSetWebp, srcSetAvif, srcSetJpeg, sizes, width, height }`
 */
export interface PictureProps {
  src:          string;
  srcSetWebp:   string;
  srcSetAvif:   string;
  srcSetJpeg:   string;
  sizes:        string;
  width:        number;
  height:       number;
}

export function buildPictureProps(
  variants: RenderedVariant[],
  masterUrl: string,
  context?: string | null,
  fallbackSizes?: string,
): PictureProps {
  const original = variants.find((v) => v.preset === 'original' && v.format === 'webp')
                ?? variants.find((v) => v.preset === 'original')
                ?? variants[variants.length - 1];

  return {
    src:         getVariantUrl(variants, 'original', 'webp') ?? masterUrl,
    srcSetWebp:  buildSrcSet(variants, 'webp'),
    srcSetAvif:  buildSrcSet(variants, 'avif'),
    srcSetJpeg:  buildSrcSet(variants, 'jpeg'),
    sizes:       buildSizes(context, fallbackSizes),
    width:       original?.width  ?? 0,
    height:      original?.height ?? 0,
  };
}
