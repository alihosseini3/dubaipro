/**
 * Canonical text slugifier for the whole app (categories, suppliers,
 * products, pages, …).
 *
 * Lowercase, ASCII-alphanumeric + single hyphens. Non-Latin input (fa/ar/ur)
 * produces an empty string — callers must supply their own fallback, e.g.
 * `slugify(name) || 'supplier'` (see lib/suppliers/slug.ts).
 *
 * Filename slugging lives separately in lib/media/seo.ts (`slugifyFilename`)
 * because it must preserve extensions and handle upload-specific edge cases.
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}
