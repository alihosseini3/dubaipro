/**
 * SEO helpers for the Smart Media Engine.
 *
 *   - `slugifyFilename`     — turn arbitrary upload names into search-
 *                             engine-friendly slugs ("IMG_2934.JPG" →
 *                             "img-2934").
 *   - `buildAutoAlt`        — derive an `alt` text from product/brand/
 *                             category/color hints when the user
 *                             leaves the field blank.
 *   - `normalizeKeywords`   — clean a free-form keyword string/array.
 */

/** Strip extension, lower-case, replace non-alnum with `-`. */
export function slugifyFilename(original: string): string {
  const base = original.replace(/\.[^.]+$/, ''); // strip extension
  return (
    base
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '') // strip diacritics
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'image'
  );
}

/** Concatenate context hints into a clean alt sentence, ≤ 160 chars. */
export interface AutoAltInput {
  productTitle?: string | null;
  brandName?:    string | null;
  categoryName?: string | null;
  color?:        string | null;
  variant?:      string | null;
  /** Fallback when nothing else is provided. */
  fallback?:     string;
}

export function buildAutoAlt(input: AutoAltInput): string {
  const parts = [
    input.brandName,
    input.productTitle,
    input.color,
    input.variant,
    input.categoryName,
  ]
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean);

  if (parts.length === 0) return (input.fallback ?? 'image').trim().slice(0, 160);

  // Deduplicate (e.g. brand already in title) using lower-cased compare.
  const seen = new Set<string>();
  const unique = parts.filter((p) => {
    const key = p.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.join(' ').slice(0, 160);
}

/** Accept a comma/space/array input and return a clean string[]. */
export function normalizeKeywords(input: unknown, max = 12): string[] {
  let arr: string[];
  if (Array.isArray(input)) {
    arr = input.filter((v): v is string => typeof v === 'string');
  } else if (typeof input === 'string') {
    arr = input.split(/[,\n]/g);
  } else {
    return [];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of arr) {
    const trimmed = raw.trim().slice(0, 40);
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= max) break;
  }
  return out;
}

/** Clamp text fields to their persisted column length. */
export function clampSeoText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}
