/**
 * Smart Media Engine — shared types.
 *
 * These types are the single source of truth shared by:
 *   - the upload pipeline (lib/media/pipeline.ts)
 *   - API routes        (app/api/media/*)
 *   - UI components     (components/media/*)
 *
 * Keep this file dependency-free (no Prisma imports) so it can be
 * imported from both server and client modules without bundling
 * `@prisma/client` into the browser build.
 */

/** Output formats produced by the pipeline. */
export type MediaFormat = 'webp' | 'avif' | 'jpeg' | 'png';

/** Standard responsive size buckets. `original` keeps the master width. */
export type MediaPreset = 'thumb' | 'small' | 'medium' | 'large' | 'original';

/** Upload context — drives default preset, ratio hints, validation. */
export type MediaContext =
  | 'product-cover'
  | 'product-gallery'
  | 'hero'
  | 'category'
  | 'brand'
  | 'supplier'
  | 'blog'
  | 'avatar'
  | 'banner'
  | 'page'
  | 'general';

/** A single rendered file: one (preset, format) tuple. */
export interface VariantSpec {
  preset: MediaPreset;
  format: MediaFormat;
  /** Max width in px. `0` keeps the source dimension. */
  width: number;
  /** Encoder quality 1-100. */
  quality: number;
}

/** Render result for one variant after Sharp has run. */
export interface RenderedVariant {
  preset: MediaPreset;
  format: MediaFormat;
  filename: string;
  url: string;
  width: number;
  height: number;
  size: number;
}

/** SEO metadata captured during upload — all optional. */
export interface MediaSeoInput {
  alt?: string;
  title?: string;
  seoTitle?: string;
  caption?: string;
  description?: string;
  keywords?: string[];
}

/** Pipeline input parameters. */
export interface PipelineOptions {
  /** Original file buffer (image only — videos bypass the pipeline). */
  buffer: Buffer;
  /** Original filename, used as the slug seed. */
  originalName: string;
  /** Source MIME (validated upstream). */
  mimeType: string;
  /** Upload context preset key. */
  context?: MediaContext;
  /** Destination folder label (gallery filter). */
  folder?: string;
  /** Override the master max dimension (else taken from context). */
  maxDimension?: number;
  /** Master encoder quality (1-100). Variants always use a slightly
   *  lower quality. Default 82. */
  quality?: number;
  /** Strip EXIF metadata. Default true. */
  stripMeta?: boolean;
  /** Skip AVIF encoding (much slower) — default false. */
  skipAvif?: boolean;
  /** SEO inputs entered at upload time. */
  seo?: MediaSeoInput;
  /** Tag list. */
  tags?: string[];
  /** Focal point (0..1) for smart-crop renditions later. */
  focal?: { x: number; y: number };
}

/** Final result returned to the API caller. */
export interface PipelineResult {
  /** MediaAsset row id. */
  id: string;
  /** Master URL (largest WebP). */
  url: string;
  /** 400px WebP thumbnail. */
  thumbnailUrl: string | null;
  /** Encoded dimensions of the master. */
  width: number;
  height: number;
  /** Original byte length. */
  originalSize: number;
  /** Master byte length after compression. */
  size: number;
  /** Savings ratio 0..1 (1 = 100% smaller, 0 = no gain). */
  compressionRatio: number;
  /** Health score 0-100. */
  optimizationScore: number;
  /** SHA-256 of the original bytes. */
  hash: string;
  /** Was an existing asset returned (duplicate)? */
  duplicate: boolean;
  /** All persisted variants. */
  variants: RenderedVariant[];
  /** Base64 LQIP. */
  blurDataURL: string | null;
  /** Approximate dominant color hex. */
  dominantColor: string | null;
  /** Echoed mime of the master (typically image/webp). */
  mimeType: string;
}

/** Score breakdown used by the health badge UI. */
export interface MediaScoreBreakdown {
  total: number;
  hasAlt: number;
  goodSize: number;
  hasModernFormat: number;
  hasResponsive: number;
  hasKeywords: number;
  goodDimensions: number;
}
