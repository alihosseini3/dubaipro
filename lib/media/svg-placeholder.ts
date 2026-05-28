/**
 * SVG-based image placeholders.
 *
 * Two variants:
 *   1. Solid color from dominant color hex  — < 150 bytes
 *   2. Linear gradient (2-color mesh)       — ~ 250 bytes
 *
 * Both are returned as `data:image/svg+xml;base64,...` strings
 * so they can be used as CSS background-image or as a src
 * before the real image loads.
 *
 * These are purely client-side helpers — no sharp, no server deps.
 */

/**
 * Solid background SVG from a dominant color.
 * Falls back to a neutral grey if the color is invalid.
 */
export function solidColorPlaceholder(
  dominantColor: string | null | undefined,
  width  = 1,
  height = 1,
): string {
  const color = isHex(dominantColor) ? dominantColor! : '#e5e7eb';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${color}"/></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Linear gradient SVG using the dominant color + a lightened tint.
 * Gives a subtle shimmer effect while the real image loads.
 */
export function gradientPlaceholder(
  dominantColor: string | null | undefined,
  direction: 'to-bottom' | 'to-right' | 'diagonal' = 'to-bottom',
  width  = 400,
  height = 300,
): string {
  const base  = isHex(dominantColor) ? dominantColor! : '#d1d5db';
  const light = lighten(base, 0.25);
  const gradId = 'g1';
  const [x1, y1, x2, y2] = direction === 'to-right'
    ? [0, 0, 1, 0]
    : direction === 'diagonal'
    ? [0, 0, 1, 1]
    : [0, 0, 0, 1];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="${gradId}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0%" stop-color="${base}"/><stop offset="100%" stop-color="${light}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#${gradId})"/></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Wave shimmer animation SVG — like a skeleton loader.
 * ~500 bytes. Good for image cards that show loading state.
 */
export function shimmerPlaceholder(
  dominantColor: string | null | undefined,
  width  = 400,
  height = 300,
): string {
  const base  = isHex(dominantColor) ? dominantColor! : '#e5e7eb';
  const light = lighten(base, 0.35);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="shimmer" x1="0" y1="0" x2="1" y2="0"><stop offset="0%"  stop-color="${base}" /><stop offset="50%" stop-color="${light}"/><stop offset="100%" stop-color="${base}"/><animateTransform attributeName="gradientTransform" type="translate" values="-2 0;2 0;-2 0" dur="1.5s" repeatCount="indefinite"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#shimmer)"/></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/* ── helpers ── */

function isHex(v: string | null | undefined): boolean {
  return typeof v === 'string' && /^#[0-9a-f]{3,6}$/i.test(v.trim());
}

/** Lighten a hex color by mixing toward white. `amount` 0..1. */
function lighten(hex: string, amount: number): string {
  const full = hex.replace('#', '');
  const len  = full.length === 3 ? 1 : 2;
  const [r, g, b] = [0, len, len * 2].map((i) => parseInt(full.slice(i, i + len).padEnd(2, full[i + len - 1]!), 16));
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `#${[r, g, b].map(mix).map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}
