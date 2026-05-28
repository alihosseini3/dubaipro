/**
 * Smart Media Engine — public barrel.
 *
 * Re-exports the small surface needed by API routes and UI components.
 * Internal helpers (Sharp encoders, FS store) stay in their own
 * modules so callers can import them directly when needed.
 */

export * from './types';
export {
  MEDIA_CONTEXTS,
  getMediaContext,
  isMediaContext,
  type MediaContextConfig,
} from './context';
export { runMediaPipeline } from './pipeline';
export { computeMediaScore } from './score';
export {
  trackMediaUsage,
  trackMediaUsages,
  untrackEntityUsage,
  untrackMediaUsage,
  countAssetUsage,
  listAssetUsage,
  type MediaUsageEntity,
  type UsageInput,
  type UsageRow,
} from './usage';
export {
  buildAutoAlt,
  clampSeoText,
  normalizeKeywords,
  slugifyFilename,
  type AutoAltInput,
} from './seo';
export {
  buildVariantSpecs,
  specsForFormat,
  FORMAT_PRIORITY,
} from './variants';
export {
  extForFormat,
  isMediaFormat,
  mimeForFormat,
} from './formats';
export { MEDIA_PUBLIC_DIR } from './store/fs-store';
export {
  getPreset,
  presetFromContext,
  ALL_PRESETS,
  PRESET_IDS,
  type MediaPreset,
} from './presets';
export {
  uploadLimiter,
  replaceLimiter,
  altSuggestLimiter,
  clientKey,
  TokenBucketLimiter,
} from './rate-limit';
export {
  generateImageMeta,
  isAiVisionEnabled,
  type VisionResult,
} from './ai-vision';
export {
  solidColorPlaceholder,
  gradientPlaceholder,
  shimmerPlaceholder,
} from './svg-placeholder';
export { storageAdapter } from './store/index';
export {
  listMediaAssets,
  getMediaAssetById,
  countMediaAssets,
  getSeoHealthStats,
  type SeoHealthStats,
  listMediaAssetsSeo,
  listMediaFolders,
  scheduleTransformJob,
  claimNextTransformJob,
  type MediaListFilters,
  type MediaListPagination,
  type MediaListOptions,
  type MediaListResult,
  type MediaSortKey,
  type SortDir,
  type MediaAssetListItem,
  type MediaAssetSeo,
} from './service';
export {
  buildImageObject,
  buildImageObjectList,
  buildImageObjectScript,
  buildImageListScript,
  type ImageObjectOptions,
  type SchemaImageObject,
} from './structured-data';
export {
  buildSitemapEntry,
  buildSitemapEntriesPerAsset,
  renderSitemapUrlXml,
  renderImageSitemapXml,
  type SitemapImage,
  type SitemapUrlEntry,
} from './sitemap';
export {
  buildSrcSet,
  buildSrcSetMap,
  buildSizes,
  buildPictureProps,
  getVariantUrl,
  getVariantUrlForWidth,
  type PictureProps,
} from './srcset';
