/**
 * Per-context preset configuration for the Smart Media Engine.
 *
 * Each context describes:
 *   - the recommended master max-dimension,
 *   - the visual aspect ratio hint shown in the upload UI,
 *   - i18n keys (resolved by next-intl in the components) so labels
 *     are translatable instead of hard-coded.
 *
 * NOTE: this module replaces the legacy `lib/upload/context.ts` for new
 * code, but the old module is left in place to avoid breaking any
 * components that still import from it.
 */

import type { MediaContext } from './types';

export interface MediaContextConfig {
  /** Max px on the longer side for the master rendition. */
  maxDimension: number;
  /** Auto-thumbnail size. */
  thumbnailSize: number;
  /** Visual aspect ratio hint (e.g. "1:1"). */
  suggestedRatio?: string;
  /** Minimum dimensions a sane upload should have (warn below). */
  minWidth: number;
  minHeight: number;
  /** Default folder bucket the gallery groups uploads into. */
  defaultFolder: string;
  /**
   * i18n key under the `media.context.<key>` namespace.
   * Components resolve it via `useTranslations('media.context')`.
   */
  i18nKey: string;
}

export const MEDIA_CONTEXTS: Record<MediaContext, MediaContextConfig> = {
  'product-cover': {
    maxDimension: 1200,
    thumbnailSize: 400,
    suggestedRatio: '1:1',
    minWidth: 600,
    minHeight: 600,
    defaultFolder: 'products',
    i18nKey: 'productCover',
  },
  'product-gallery': {
    maxDimension: 1600,
    thumbnailSize: 400,
    suggestedRatio: '1:1',
    minWidth: 800,
    minHeight: 800,
    defaultFolder: 'products',
    i18nKey: 'productGallery',
  },
  hero: {
    maxDimension: 2400,
    thumbnailSize: 800,
    suggestedRatio: '12:5',
    minWidth: 1600,
    minHeight: 600,
    defaultFolder: 'banners',
    i18nKey: 'hero',
  },
  category: {
    maxDimension: 1000,
    thumbnailSize: 400,
    suggestedRatio: '1:1',
    minWidth: 600,
    minHeight: 600,
    defaultFolder: 'categories',
    i18nKey: 'category',
  },
  brand: {
    maxDimension: 600,
    thumbnailSize: 200,
    suggestedRatio: '1:1',
    minWidth: 300,
    minHeight: 300,
    defaultFolder: 'brands',
    i18nKey: 'brand',
  },
  supplier: {
    maxDimension: 600,
    thumbnailSize: 200,
    suggestedRatio: '1:1',
    minWidth: 300,
    minHeight: 300,
    defaultFolder: 'suppliers',
    i18nKey: 'supplier',
  },
  blog: {
    maxDimension: 1600,
    thumbnailSize: 600,
    suggestedRatio: '40:21',
    minWidth: 1200,
    minHeight: 630,
    defaultFolder: 'blog',
    i18nKey: 'blog',
  },
  avatar: {
    maxDimension: 512,
    thumbnailSize: 150,
    suggestedRatio: '1:1',
    minWidth: 200,
    minHeight: 200,
    defaultFolder: 'avatars',
    i18nKey: 'avatar',
  },
  banner: {
    maxDimension: 1920,
    thumbnailSize: 600,
    suggestedRatio: '16:9',
    minWidth: 1200,
    minHeight: 400,
    defaultFolder: 'banners',
    i18nKey: 'banner',
  },
  page: {
    maxDimension: 1600,
    thumbnailSize: 400,
    minWidth: 800,
    minHeight: 400,
    defaultFolder: 'pages',
    i18nKey: 'page',
  },
  general: {
    maxDimension: 1920,
    thumbnailSize: 400,
    minWidth: 0,
    minHeight: 0,
    defaultFolder: 'general',
    i18nKey: 'general',
  },
};

export function getMediaContext(ctx?: MediaContext | null): MediaContextConfig {
  if (!ctx || !(ctx in MEDIA_CONTEXTS)) return MEDIA_CONTEXTS.general;
  return MEDIA_CONTEXTS[ctx];
}

export function isMediaContext(value: unknown): value is MediaContext {
  return typeof value === 'string' && value in MEDIA_CONTEXTS;
}
