export type MediaAsset = {
  id: string;
  filename: string;
  originalName: string;
  url: string;
  thumbnailUrl?: string | null;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string | null;
  title: string | null;
  caption: string | null;
  keywords: string[];
  folder: string;
  tags: string[];
  createdAt: string;
  updatedAt?: string;
  optimizationScore?: number | null;
  compressionRatio?: number | null;
  dominantColor?: string | null;
  blurDataURL?: string | null;
  processingStatus?: string;
  storageProvider?: string;
  context?: string | null;
  uploadedBy?: { id?: string; name: string; } | null;
  variants?: { preset: string; format: string; url: string; width: number; height: number; size: number }[];
  _count?: { usages: number };
};

export type FolderInfo = {
  name: string;
  count: number;
  label: string | null;
  custom: boolean;
};

export type View = 'grid' | 'list';
export type Sort = 'newest' | 'oldest' | 'name' | 'size';
export type TypeFilter = 'all' | 'image' | 'video';

export function fmtSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export function folderLabel(name: string, label?: string | null): string {
  if (label) return label;
  if (name === 'all') return 'All Files';
  if (name.startsWith('cat-')) return name.slice(4).replace(/-/g, ' ');
  return name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' ');
}

export const PRESET_FOLDERS = ['general', 'products', 'categories', 'banners', 'blog', 'brands'];

export interface SeoHealthStats {
  total:           number;
  missingAlt:      number;
  missingKeywords: number;
  noWebP:          number;
  noAvif:          number;
  oversized:       number;
  noResponsive:    number;
  unused:          number;
  duplicates:      number;
  lowScore:        number;
  scoreAvg:        number;
}

export interface AdvancedFilters {
  noAlt?:      boolean;
  noWebP?:     boolean;
  noAvif?:     boolean;
  unused?:     boolean;
  duplicates?: boolean;
  minSize?:    number;
  maxSize?:    number;
  minWidth?:   number;
  maxWidth?:   number;
  minScore?:   number;
  maxScore?:   number;
  mimeType?:   string;
  processingStatus?: string;
}
