/**
 * Responsive variant matrix.
 *
 * Given a master max-dimension we derive the breakpoints below. The
 * pipeline then renders each spec in BOTH WebP and AVIF (configurable),
 * plus a JPEG fallback at the master size for legacy clients.
 *
 * Default ladder (master = 1600px):
 *   thumb     200px  q70   webp+avif
 *   small     400px  q72   webp+avif
 *   medium    800px  q78   webp+avif
 *   large    1200px  q80   webp+avif
 *   original 1600px  q82   webp+avif+jpeg
 */

import type { MediaFormat, MediaPreset, VariantSpec } from './types';

interface PresetSpec {
  preset: MediaPreset;
  /** Multiplier of the master max-dimension. */
  scale: number;
  /** Absolute floor in px (so thumbs stay sharp on small masters). */
  min: number;
  quality: number;
}

const LADDER: PresetSpec[] = [
  { preset: 'thumb',    scale: 0.125, min: 200,  quality: 70 },
  { preset: 'small',    scale: 0.25,  min: 400,  quality: 72 },
  { preset: 'medium',   scale: 0.5,   min: 600,  quality: 78 },
  { preset: 'large',    scale: 0.75,  min: 900,  quality: 80 },
  { preset: 'original', scale: 1,     min: 0,    quality: 82 },
];

/**
 * Build the full variant spec list for a given master dimension.
 *
 * @param masterMax  Master max-dimension in px (longer side).
 * @param formats    Output formats. Default ['webp','avif'] + jpeg @ original.
 */
export function buildVariantSpecs(
  masterMax: number,
  formats: MediaFormat[] = ['webp', 'avif'],
): VariantSpec[] {
  const out: VariantSpec[] = [];
  const safeMax = Math.max(200, Math.floor(masterMax));

  for (const step of LADDER) {
    const target = Math.max(step.min, Math.round(safeMax * step.scale));
    // Skip variants larger than the master (no upscaling).
    const width = Math.min(target, safeMax);

    for (const format of formats) {
      out.push({ preset: step.preset, format, width, quality: step.quality });
    }

    // Always include a JPEG fallback at the `original` preset for legacy
    // clients (some Asian carriers proxy/strip AVIF + WebP). Smaller
    // presets never need JPEG because they're served via <picture>.
    if (step.preset === 'original' && !formats.includes('jpeg')) {
      out.push({
        preset: 'original',
        format: 'jpeg',
        width,
        quality: 85,
      });
    }
  }

  return out;
}

/**
 * Convenience: filter a spec list to a single format. Used by tests and
 * by the gallery UI for "WebP only" preview links.
 */
export function specsForFormat(
  specs: VariantSpec[],
  format: MediaFormat,
): VariantSpec[] {
  return specs.filter((s) => s.format === format);
}

/**
 * The "served" format priority — first format the browser supports
 * via the <picture> element wins. Kept here as the canonical source so
 * SmartImage and the SEO score module agree.
 */
export const FORMAT_PRIORITY: MediaFormat[] = ['avif', 'webp', 'jpeg', 'png'];
