/**
 * Per-context upload configuration.
 * Drives: recommended maxDimension, thumbnail size, ratio hint shown in UI.
 */

export type UploadContext =
  | 'product-cover'
  | 'product-gallery'
  | 'hero'
  | 'category'
  | 'brand'
  | 'supplier'
  | 'blog'
  | 'avatar'
  | 'banner'
  | 'page'
  | 'general';

export interface ContextConfig {
  /** Max px on the longer side for the main image */
  maxDimension: number;
  /** Max px for the auto-generated thumbnail */
  thumbnailSize: number;
  /** Visual ratio hint, e.g. "1:1" */
  suggestedRatio?: string;
  /** Short label for display */
  label: string;
  /** Recommendation text shown in the upload UI */
  hint: string;
}

export const CONTEXT_CONFIGS: Record<UploadContext, ContextConfig> = {
  'product-cover': {
    maxDimension:  800,
    thumbnailSize: 400,
    suggestedRatio: '1:1',
    label: 'تصویر شاخص محصول',
    hint:  'مربع ۸۰۰×۸۰۰ — thumbnail 400px برای لیست محصولات تولید می‌شود',
  },
  'product-gallery': {
    maxDimension:  1200,
    thumbnailSize: 400,
    suggestedRatio: '4:3',
    label: 'گالری محصول',
    hint:  'حداکثر ۱۲۰۰ پیکسل — نسبت ۴:۳ پیشنهاد می‌شود',
  },
  'hero': {
    maxDimension:  1920,
    thumbnailSize: 800,
    suggestedRatio: '16:6',
    label: 'بنر اصلی',
    hint:  'عریض ۱۹۲۰×۷۲۰ — بزرگ‌ترین تصویر سایت',
  },
  'category': {
    maxDimension:  600,
    thumbnailSize: 300,
    suggestedRatio: '3:2',
    label: 'تصویر دسته‌بندی',
    hint:  'حداکثر ۶۰۰ پیکسل — نسبت ۳:۲ پیشنهاد می‌شود',
  },
  'brand': {
    maxDimension:  400,
    thumbnailSize: 200,
    suggestedRatio: '1:1',
    label: 'لوگوی برند',
    hint:  'مربع ۴۰۰×۴۰۰ — PNG با پس‌زمینه شفاف توصیه می‌شود',
  },
  'blog': {
    maxDimension:  1200,
    thumbnailSize: 600,
    suggestedRatio: '16:9',
    label: 'تصویر مقاله',
    hint:  'حداکثر ۱۲۰۰×۶۷۵ — نسبت ۱۶:۹ پیشنهاد می‌شود',
  },
  'avatar': {
    maxDimension:  300,
    thumbnailSize: 150,
    suggestedRatio: '1:1',
    label: 'آواتار / پروفایل',
    hint:  'مربع — حداکثر ۳۰۰×۳۰۰ پیکسل',
  },
  'supplier': {
    maxDimension:  600,
    thumbnailSize: 300,
    suggestedRatio: '1:1',
    label: 'لوگوی تامین‌کننده',
    hint:  'مربع ۶۰۰×۶۰۰ — لوگو یا تصویر شناسایی برند',
  },
  'banner': {
    maxDimension:  1600,
    thumbnailSize: 600,
    suggestedRatio: '16:9',
    label: 'بنر / تبلیغات',
    hint:  'حداکثر ۱۶۰۰ پیکسل — نسبت ۱۶:۹ یا ۲:۱ پیشنهاد می‌شود',
  },
  'page': {
    maxDimension:  1200,
    thumbnailSize: 400,
    suggestedRatio: '4:3',
    label: 'تصویر صفحه',
    hint:  'حداکثر ۱۲۰۰ پیکسل — برای محتوای صفحات استاتیک',
  },
  'general': {
    maxDimension:  1920,
    thumbnailSize: 400,
    label: 'عمومی',
    hint:  'حداکثر ۱۹۲۰ پیکسل — فرمت WebP پیشنهاد می‌شود',
  },
};

export function getContextConfig(ctx?: UploadContext): ContextConfig {
  return CONTEXT_CONFIGS[ctx ?? 'general'];
}
