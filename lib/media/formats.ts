/**
 * Sharp encoder per (preset, format).
 *
 * The encoder is intentionally tiny — it accepts a pre-rotated/EXIF-
 * stripped Sharp pipeline (so resize is reused across formats) and
 * writes a single rendition.
 */

import sharp from 'sharp';

import type { MediaFormat, RenderedVariant, VariantSpec } from './types';

const MIME: Record<MediaFormat, string> = {
  webp: 'image/webp',
  avif: 'image/avif',
  jpeg: 'image/jpeg',
  png:  'image/png',
};

const EXT: Record<MediaFormat, string> = {
  webp: 'webp',
  avif: 'avif',
  jpeg: 'jpg',
  png:  'png',
};

export function mimeForFormat(format: MediaFormat): string { return MIME[format]; }
export function extForFormat(format: MediaFormat):  string { return EXT[format]; }

export function isMediaFormat(value: unknown): value is MediaFormat {
  return typeof value === 'string' && value in MIME;
}

export interface EncodeResult {
  buffer: Buffer;
  width: number;
  height: number;
  size: number;
}

/**
 * Encode one variant from a source buffer. Resizes to `spec.width`
 * preserving aspect ratio, never upscaling.
 *
 * Sharp instances are NOT reusable once a writer has been attached, so
 * we always start from a fresh `sharp(input)` instance.
 */
export async function encodeVariant(
  input: Buffer,
  spec: VariantSpec,
  opts: { stripMeta?: boolean } = {},
): Promise<EncodeResult> {
  const { stripMeta = true } = opts;

  let pipeline = sharp(input, { failOn: 'error' }).rotate();

  if (spec.width > 0) {
    pipeline = pipeline.resize(spec.width, null, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  switch (spec.format) {
    case 'webp':
      pipeline = pipeline.webp({ quality: spec.quality, effort: 4 });
      break;
    case 'avif':
      // effort 4 is the sweet spot: ~2× slower than webp, ~30% smaller.
      pipeline = pipeline.avif({ quality: spec.quality, effort: 4 });
      break;
    case 'jpeg':
      pipeline = pipeline.jpeg({ quality: spec.quality, mozjpeg: true });
      break;
    case 'png':
      pipeline = pipeline.png({ compressionLevel: 9 });
      break;
  }

  if (stripMeta) {
    pipeline = pipeline.withMetadata({ exif: {} });
  }

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    width:  info.width,
    height: info.height,
    size:   info.size,
  };
}

/**
 * Build the variant filename from the slugified base name.
 *   <base>-<preset>.<ext>            (single format)
 *   <base>-<preset>.<ext>            (preset='original' uses base only? No —
 *                                     keeping preset suffix avoids collisions.)
 *
 * The hash suffix is provided by the caller so identical buffers
 * produce identical filenames (helps long-term caching).
 */
export function buildVariantFilename(
  baseSlug: string,
  hashShort: string,
  preset: string,
  format: MediaFormat,
): string {
  const safeBase = baseSlug.replace(/[^a-z0-9-_]+/gi, '-').slice(0, 60) || 'image';
  return `${safeBase}-${hashShort}-${preset}.${EXT[format]}`;
}

/** Map a `RenderedVariant` to a public URL. */
export function buildVariantUrl(publicDir: string, filename: string): string {
  // publicDir starts with `/`, no trailing slash.
  return `${publicDir}/${filename}`;
}

/** Convenience builder consumed by `pipeline.ts`. */
export function toRenderedVariant(
  spec: VariantSpec,
  encoded: EncodeResult,
  filename: string,
  url: string,
): RenderedVariant {
  return {
    preset: spec.preset,
    format: spec.format,
    filename,
    url,
    width:  encoded.width,
    height: encoded.height,
    size:   encoded.size,
  };
}
