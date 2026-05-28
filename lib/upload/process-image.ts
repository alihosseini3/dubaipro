import sharp from 'sharp';

export type OutputFormat = 'webp' | 'jpeg' | 'png' | 'avif';

/** @deprecated Use numeric quality in ProcessOptions instead */
export type QualityPreset = 'high' | 'medium' | 'low';
const QUALITY_PRESET_MAP: Record<QualityPreset, number> = { high: 90, medium: 80, low: 65 };

export interface ProcessOptions {
  format?: OutputFormat;
  /** 30–100, default 80 */
  quality?: number;
  /** Max px on longer side (0 = no limit). Default 1920 */
  maxDimension?: number;
  /** Strip EXIF/GPS metadata. Default true */
  stripMeta?: boolean;
}

export interface ImageProcessResult {
  buffer: Buffer;
  format: OutputFormat;
  mimeType: string;
  width: number;
  height: number;
  size: number;
  originalSize: number;
  savingsPct: number;
}

const MIME: Record<OutputFormat, string> = {
  webp: 'image/webp',
  jpeg: 'image/jpeg',
  png:  'image/png',
  avif: 'image/avif',
};

const EXT: Record<OutputFormat, string> = {
  webp: 'webp',
  jpeg: 'jpg',
  png:  'png',
  avif: 'avif',
};

export function extForFormat(fmt: OutputFormat)  { return EXT[fmt]; }
export function mimeForFormat(fmt: OutputFormat) { return MIME[fmt]; }

export function isValidOutputFormat(v: string): v is OutputFormat {
  return ['webp', 'jpeg', 'png', 'avif'].includes(v);
}

/** @deprecated use numeric quality check (30–100) */
export function isValidQualityPreset(v: string): v is QualityPreset {
  return ['high', 'medium', 'low'].includes(v);
}

/**
 * Generate a small thumbnail. Always outputs WebP @ quality 72.
 */
export async function generateThumbnail(
  input: Buffer,
  maxSize: number = 400,
): Promise<Buffer> {
  const { data } = await sharp(input)
    .resize(maxSize, maxSize, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 72, effort: 4 })
    .toBuffer({ resolveWithObject: true });
  return data;
}

/**
 * Process an image buffer through Sharp.
 *
 * - Strip EXIF/metadata (privacy-safe)
 * - Resize to maxDimension (no upscale)
 * - Convert format + compress
 * - Returns processed buffer + stats
 */
export async function processImage(
  input: Buffer,
  options?: ProcessOptions,
): Promise<ImageProcessResult>;

/** @deprecated Pass options object instead */
export async function processImage(
  input: Buffer,
  format?: OutputFormat,
  qualityPreset?: QualityPreset,
): Promise<ImageProcessResult>;

export async function processImage(
  input: Buffer,
  formatOrOptions?: OutputFormat | ProcessOptions,
  legacyPreset?: QualityPreset,
): Promise<ImageProcessResult> {
  // Resolve overloads
  let opts: ProcessOptions;
  if (typeof formatOrOptions === 'string' || formatOrOptions === undefined) {
    const quality = legacyPreset ? QUALITY_PRESET_MAP[legacyPreset] : 80;
    opts = { format: formatOrOptions, quality };
  } else {
    opts = formatOrOptions;
  }

  const {
    format       = 'webp',
    quality      = 80,
    maxDimension = 1920,
    stripMeta    = true,
  } = opts;

  const clampedQ = Math.max(30, Math.min(100, Math.round(quality)));
  const originalSize = input.byteLength;

  let pipeline = sharp(input);

  if (stripMeta) {
    pipeline = pipeline.rotate(); // auto-rotate by EXIF then strip
  }

  if (maxDimension > 0) {
    pipeline = pipeline.resize(maxDimension, maxDimension, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  switch (format) {
    case 'webp': pipeline = pipeline.webp({ quality: clampedQ, effort: 4 });  break;
    case 'jpeg': pipeline = pipeline.jpeg({ quality: clampedQ, mozjpeg: true }); break;
    case 'png':  pipeline = pipeline.png({ compressionLevel: 9 }); break;
    case 'avif': pipeline = pipeline.avif({ quality: clampedQ, effort: 4 });  break;
  }

  if (stripMeta) {
    pipeline = pipeline.withMetadata({ exif: {} }); // keep orientation, strip everything else
  }

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

  const savingsPct = originalSize > 0
    ? Math.round((1 - info.size / originalSize) * 100)
    : 0;

  return {
    buffer:       data,
    format,
    mimeType:     MIME[format],
    width:        info.width,
    height:       info.height,
    size:         info.size,
    originalSize,
    savingsPct,
  };
}
