/**
 * JSON-LD structured data generators for media assets.
 *
 * Produces schema.org ImageObject and related markup consumed by:
 *   - Product detail pages  (primary image + gallery)
 *   - Blog post pages       (article cover image)
 *   - Category / brand pages
 *   - Sitemap image entries
 *
 * Usage (Server Component):
 *   import { buildImageObjectScript } from '@/lib/media/structured-data';
 *   <script type="application/ld+json" dangerouslySetInnerHTML={{__html: buildImageObjectScript(asset, { pageUrl }) }} />
 */

import type { MediaAssetSeo } from './service';

/* ─────────────────────────────────────────────────────────────────────────── */
/* Types                                                                        */
/* ─────────────────────────────────────────────────────────────────────────── */

export interface ImageObjectOptions {
  /** Canonical URL of the page embedding this image. */
  pageUrl?:     string;
  /** Absolute origin (e.g. https://dubaipro.ae) — auto-prefixes relative URLs. */
  origin?:      string;
  /** Override alt text. */
  altOverride?: string;
}

export interface SchemaImageObject {
  '@type':         'ImageObject';
  '@id':           string;
  url:             string;
  contentUrl:      string;
  name:            string | undefined;
  description:     string | undefined;
  caption:         string | undefined;
  width?:          number;
  height?:         number;
  thumbnail?:      { '@type': 'ImageObject'; url: string };
  encodingFormat:  string;
  uploadDate:      string;
  dateModified:    string;
  keywords?:       string;
  representativeOfPage?: boolean;
  author?:         { '@type': 'Organization'; name: string; url: string };
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Helpers                                                                      */
/* ─────────────────────────────────────────────────────────────────────────── */

function absoluteUrl(url: string, origin?: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = origin?.replace(/\/$/, '') ?? '';
  return `${base}${url}`;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Public API                                                                   */
/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * Build a schema.org ImageObject for a single media asset.
 */
export function buildImageObject(
  asset: MediaAssetSeo,
  opts: ImageObjectOptions = {},
): SchemaImageObject {
  const { origin, pageUrl, altOverride } = opts;

  const src  = absoluteUrl(asset.url, origin);
  const name = altOverride ?? asset.seoTitle ?? asset.title ?? asset.alt ?? undefined;

  const obj: SchemaImageObject = {
    '@type':        'ImageObject',
    '@id':          `${src}#imageObject`,
    url:            src,
    contentUrl:     src,
    name,
    description:    asset.description ?? undefined,
    caption:        asset.caption     ?? undefined,
    encodingFormat: asset.mimeType,
    uploadDate:     asset.createdAt.toISOString(),
    dateModified:   asset.updatedAt.toISOString(),
  };

  if (asset.width)           obj.width  = asset.width;
  if (asset.height)          obj.height = asset.height;
  if (asset.keywords?.length) obj.keywords = asset.keywords.join(', ');

  if (asset.thumbnailUrl) {
    obj.thumbnail = {
      '@type': 'ImageObject',
      url:     absoluteUrl(asset.thumbnailUrl, origin),
    };
  }

  if (pageUrl) obj.representativeOfPage = true;

  return obj;
}

/**
 * Build an ImageObject array for a gallery (e.g. product images).
 */
export function buildImageObjectList(
  assets: MediaAssetSeo[],
  opts: ImageObjectOptions = {},
): SchemaImageObject[] {
  return assets.map((a, i) =>
    buildImageObject(a, { ...opts, altOverride: i === 0 ? opts.altOverride : undefined }),
  );
}

/**
 * Serialize to a ready-to-embed JSON string (safe for dangerouslySetInnerHTML).
 */
export function buildImageObjectScript(
  asset: MediaAssetSeo,
  opts: ImageObjectOptions = {},
): string {
  return JSON.stringify(buildImageObject(asset, opts));
}

/**
 * Full LD+JSON wrapper for embedding multiple images in a page.
 */
export function buildImageListScript(
  assets: MediaAssetSeo[],
  opts: ImageObjectOptions = {},
): string {
  if (assets.length === 0) return '';
  if (assets.length === 1) return buildImageObjectScript(assets[0], opts);
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph':   buildImageObjectList(assets, opts),
  });
}
