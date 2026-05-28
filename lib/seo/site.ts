import { headers } from 'next/headers';
import type { Metadata } from 'next';

import { routing, type Locale } from '@/i18n/routing';

/**
 * SEO site helpers
 * ----------------
 * Single source of truth for the canonical origin and locale-aware URL
 * builders. Every Metadata producer in the app should funnel through here
 * so canonical / hreflang / OG values stay consistent.
 *
 * Resolution order for the absolute origin:
 *   1. `NEXT_PUBLIC_SITE_URL` (production, set in deployment env)
 *   2. Forwarded request headers (preview deploys, custom domains)
 *   3. `localhost:3000` (dev fallback)
 *
 * The first option is preferred because metadata is rendered into the
 * HTML head and must not vary by request — Google deduplicates pages by
 * canonical URL, and a flapping origin is a real SEO bug.
 */

export const SUPPORTED_LOCALES = routing.locales as readonly Locale[];
export const DEFAULT_LOCALE: Locale = routing.defaultLocale as Locale;

/** Returns the origin used in canonical/sitemap/robots URLs (no trailing slash). */
export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  return 'http://localhost:3000';
}

/** Async variant that falls back to forwarded headers (useful in preview envs). */
export async function getSiteUrlAsync(): Promise<string> {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/+$/, '');
  try {
    const h = await headers();
    const host = h.get('x-forwarded-host') ?? h.get('host');
    if (!host) return 'http://localhost:3000';
    const proto =
      h.get('x-forwarded-proto') ??
      (host.startsWith('localhost') || host.startsWith('127.0.0.1')
        ? 'http'
        : 'https');
    return `${proto}://${host}`;
  } catch {
    return 'http://localhost:3000';
  }
}

/**
 * Build a fully-qualified URL for a given locale + path. The path must
 * start with '/' and exclude the locale segment — this function adds it.
 */
export function buildLocaleUrl(locale: string, path = '/'): string {
  const base = getSiteUrl();
  const safe = path.startsWith('/') ? path : `/${path}`;
  // Avoid trailing slash duplication when path is '/'.
  return safe === '/' ? `${base}/${locale}` : `${base}/${locale}${safe}`;
}

/**
 * Build the `alternates` block (canonical + hreflang languages) for a
 * given page. Always include `x-default` pointing at the default locale
 * so Google has a fallback for unsupported users.
 *
 * `pathSuffix` is everything AFTER `/{locale}`, e.g. `/products/foo`.
 */
export function buildAlternates(
  currentLocale: string,
  pathSuffix = '/'
): NonNullable<Metadata['alternates']> {
  const languages: Record<string, string> = {};
  for (const l of SUPPORTED_LOCALES) {
    languages[l] = buildLocaleUrl(l, pathSuffix);
  }
  languages['x-default'] = buildLocaleUrl(DEFAULT_LOCALE, pathSuffix);
  return {
    canonical: buildLocaleUrl(currentLocale, pathSuffix),
    languages
  };
}

/**
 * OG locale tag mapping. OG expects BCP-47-ish ll_CC tags; map our short
 * codes to a sensible default region.
 */
const OG_LOCALE_MAP: Record<string, string> = {
  en: 'en_US',
  ar: 'ar_AE',
  fa: 'fa_IR',
  ur: 'ur_PK'
};

export function toOgLocale(locale: string): string {
  return OG_LOCALE_MAP[locale] ?? 'en_US';
}

export function toOgAlternateLocales(currentLocale: string): string[] {
  return SUPPORTED_LOCALES.filter((l) => l !== currentLocale).map(toOgLocale);
}

/** Site-wide brand name used in titles and Organization schema. */
export const SITE_NAME = 'Dubai Pro';

/**
 * Compose a `<title>` value of the form "Page — Site". Truncates to 60
 * chars (Google's display limit) so we never ship cropped titles.
 */
export function composeTitle(pageTitle: string): string {
  const t = pageTitle.trim();
  if (!t) return SITE_NAME;
  const full = `${t} | ${SITE_NAME}`;
  return full.length <= 60 ? full : t.slice(0, 60);
}

/** Truncate a description to ~160 chars without breaking words. */
export function truncateDescription(input: string, max = 160): string {
  const clean = input.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…';
}
