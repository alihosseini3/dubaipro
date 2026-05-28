/**
 * Image sitemap helpers.
 *
 * Google's Image Sitemap extension allows up to 1000 images per <url>
 * and requires <image:loc>, <image:title>, and <image:caption> child
 * elements. This module produces the data structure; rendering is done
 * by the Next.js sitemap route (app/sitemap.ts or a custom handler).
 *
 * Reference: https://developers.google.com/search/docs/specialty/international/image-sitemaps
 */

import type { MediaAssetSeo } from './service';

/* ─────────────────────────────────────────────────────────────────────────── */
/* Types                                                                        */
/* ─────────────────────────────────────────────────────────────────────────── */

export interface SitemapImage {
  loc:       string;
  title?:    string;
  caption?:  string;
  geoLocation?: string;
  license?:  string;
}

/** One <url> block in the sitemap with its associated <image:image> children. */
export interface SitemapUrlEntry {
  loc:    string;
  images: SitemapImage[];
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Helpers                                                                      */
/* ─────────────────────────────────────────────────────────────────────────── */

function absoluteUrl(url: string, origin: string): string {
  if (url.startsWith('http')) return url;
  return `${origin.replace(/\/$/, '')}${url}`;
}

/** Escape XML special characters for sitemap content. */
function escapeXml(str: string): string {
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&apos;');
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Public API                                                                   */
/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * Build sitemap entries grouping assets by their page URL.
 *
 * @param pageUrl   Canonical page URL that embeds all these images.
 * @param assets    MediaAsset rows (SEO projection).
 * @param origin    Absolute origin for relative image URLs.
 */
export function buildSitemapEntry(
  pageUrl: string,
  assets: MediaAssetSeo[],
  origin: string,
): SitemapUrlEntry {
  return {
    loc: pageUrl,
    images: assets
      .filter((a) => a.url)
      .map((a) => ({
        loc:     absoluteUrl(a.url, origin),
        title:   a.seoTitle ?? a.title ?? a.alt ?? undefined,
        caption: a.caption  ?? undefined,
      })),
  };
}

/**
 * Render a single sitemap URL block to XML string.
 * Suitable for embedding inside a <urlset> wrapper.
 */
export function renderSitemapUrlXml(entry: SitemapUrlEntry): string {
  if (entry.images.length === 0) return '';

  const imageBlocks = entry.images.map((img) => {
    const title   = img.title   ? `\n      <image:title>${escapeXml(img.title)}</image:title>`     : '';
    const caption = img.caption ? `\n      <image:caption>${escapeXml(img.caption)}</image:caption>` : '';
    return `    <image:image>\n      <image:loc>${escapeXml(img.loc)}</image:loc>${title}${caption}\n    </image:image>`;
  }).join('\n');

  return `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>\n${imageBlocks}\n  </url>`;
}

/**
 * Render a full standalone image sitemap XML document.
 */
export function renderImageSitemapXml(entries: SitemapUrlEntry[]): string {
  const urls = entries.map(renderSitemapUrlXml).filter(Boolean).join('\n');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset',
    '  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    urls,
    '</urlset>',
  ].join('\n');
}

/**
 * Convenience: one entry per asset, each on its own canonical URL.
 *
 * Used when assets have individual landing pages (e.g. products).
 *
 * @param assetWithPageUrl  Array of [asset, canonical page URL] tuples.
 */
export function buildSitemapEntriesPerAsset(
  assetWithPageUrl: Array<{ asset: MediaAssetSeo; pageUrl: string }>,
  origin: string,
): SitemapUrlEntry[] {
  return assetWithPageUrl.map(({ asset, pageUrl }) =>
    buildSitemapEntry(pageUrl, [asset], origin),
  );
}
