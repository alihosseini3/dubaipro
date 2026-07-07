/**
 * Media service layer — gallery queries with filtering, search, pagination.
 *
 * All DB access lives here. API routes and Server Components import
 * from this module instead of calling Prisma directly.
 */
import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { MediaContext } from './types';

/* ─────────────────────────────────────────────────────────────────────────── */
/* Types                                                                        */
/* ─────────────────────────────────────────────────────────────────────────── */

export interface MediaListFilters {
  folder?:           string;
  context?:          MediaContext;
  mimeType?:         string;
  tags?:             string[];
  processingStatus?: string;
  storageProvider?:  string;
  /** Full-text search across originalName, alt, title, seoTitle, keywords. */
  q?:                string;
  uploadedById?:     string;
  /** Advanced filters */
  noAlt?:     boolean;  // missing alt text
  noWebP?:    boolean;  // has no webp variant
  noAvif?:    boolean;  // has no avif variant
  unused?:    boolean;  // zero usage rows
  duplicates?: boolean; // same hash as another asset
  minSize?:   number;   // bytes
  maxSize?:   number;
  minWidth?:  number;   // px
  maxWidth?:  number;
  minScore?:  number;   // optimizationScore 0-100
  maxScore?:  number;
}

export interface MediaListPagination {
  page?:  number;  // 1-indexed, default 1
  limit?: number;  // default 40, max 200
}

export type MediaSortKey = 'createdAt' | 'size' | 'optimizationScore' | 'originalName';
export type SortDir = 'asc' | 'desc';

export interface MediaListOptions {
  filters?:    MediaListFilters;
  pagination?: MediaListPagination;
  sort?:       { key: MediaSortKey; dir?: SortDir };
}

const VARIANT_SELECT = {
  id:     true,
  preset: true,
  format: true,
  url:    true,
  width:  true,
  height: true,
  size:   true,
} as const;

const ASSET_LIST_SELECT = {
  id:                true,
  filename:          true,
  originalName:      true,
  url:               true,
  thumbnailUrl:      true,
  mimeType:          true,
  size:              true,
  width:             true,
  height:            true,
  alt:               true,
  title:             true,
  caption:           true,
  folder:            true,
  tags:              true,
  context:           true,
  optimizationScore: true,
  compressionRatio:  true,
  dominantColor:     true,
  blurDataURL:       true,
  processingStatus:  true,
  storageProvider:   true,
  createdAt:         true,
  updatedAt:         true,
  uploadedBy:        { select: { id: true, name: true } },
  variants:          { select: VARIANT_SELECT, orderBy: [{ preset: 'asc' as const }, { format: 'asc' as const }] },
  _count:            { select: { usages: true } },
} satisfies Prisma.MediaAssetSelect;

export type MediaAssetListItem = Prisma.MediaAssetGetPayload<{ select: typeof ASSET_LIST_SELECT }>;

/* ─────────────────────────────────────────────────────────────────────────── */
/* Query builders                                                               */
/* ─────────────────────────────────────────────────────────────────────────── */

function buildWhere(filters: MediaListFilters = {}, duplicateHashes?: string[]): Prisma.MediaAssetWhereInput {
  const where: Prisma.MediaAssetWhereInput = {};

  if (filters.folder)           where.folder           = filters.folder;
  if (filters.context)          where.context          = filters.context;
  if (filters.mimeType)         where.mimeType         = { startsWith: filters.mimeType };
  if (filters.processingStatus) where.processingStatus = filters.processingStatus;
  if (filters.storageProvider)  where.storageProvider  = filters.storageProvider;
  if (filters.uploadedById)     where.uploadedById     = filters.uploadedById;

  if (filters.tags && filters.tags.length > 0) {
    where.tags = { hasSome: filters.tags };
  }

  if (filters.q) {
    const q = filters.q.trim().slice(0, 120);
    where.OR = [
      { originalName:  { contains: q, mode: 'insensitive' } },
      { alt:           { contains: q, mode: 'insensitive' } },
      { title:         { contains: q, mode: 'insensitive' } },
      { seoTitle:      { contains: q, mode: 'insensitive' } },
      { caption:       { contains: q, mode: 'insensitive' } },
      { description:   { contains: q, mode: 'insensitive' } },
      { tags:          { has: q } },
      { keywords:      { has: q } },
    ];
  }

  /* ── Advanced filters ────────────────────────────────────────────────── */
  if (filters.noAlt) {
    const noAltCondition = { OR: [{ alt: null as string | null }, { alt: '' }] };
    if (where.OR) {
      // Wrap search OR in an AND so both conditions must be satisfied
      where.AND = [{ OR: where.OR }, noAltCondition];
      delete where.OR;
    } else {
      where.OR = noAltCondition.OR;
    }
  }

  if (filters.noWebP) where.variants = { none: { format: 'webp' } };
  if (filters.noAvif) where.variants = { none: { format: 'avif' } };

  if (filters.unused)     where.usages = { none: {} };
  if (duplicateHashes?.length) where.hash = { in: duplicateHashes };

  if (filters.minSize !== undefined) where.size = { ...(where.size as object), gte: filters.minSize };
  if (filters.maxSize !== undefined) where.size = { ...(where.size as object), lte: filters.maxSize };

  if (filters.minWidth !== undefined) where.width = { ...(where.width as object), gte: filters.minWidth };
  if (filters.maxWidth !== undefined) where.width = { ...(where.width as object), lte: filters.maxWidth };

  if (filters.minScore !== undefined) where.optimizationScore = { ...(where.optimizationScore as object), gte: filters.minScore };
  if (filters.maxScore !== undefined) where.optimizationScore = { ...(where.optimizationScore as object), lte: filters.maxScore };

  return where;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Public API                                                                   */
/* ─────────────────────────────────────────────────────────────────────────── */

export interface MediaListResult {
  items:      MediaAssetListItem[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}

export async function listMediaAssets(opts: MediaListOptions = {}): Promise<MediaListResult> {
  const page  = Math.max(1, opts.pagination?.page  ?? 1);
  const limit = Math.min(200, Math.max(1, opts.pagination?.limit ?? 40));
  const skip  = (page - 1) * limit;

  const sortKey = opts.sort?.key ?? 'createdAt';
  const sortDir = opts.sort?.dir ?? 'desc';
  const orderBy: Prisma.MediaAssetOrderByWithRelationInput = { [sortKey]: sortDir };

  // Resolve duplicate hashes first (needs separate query)
  let duplicateHashes: string[] | undefined;
  if (opts.filters?.duplicates) {
    const rows = await prisma.mediaAsset.groupBy({
      by: ['hash'],
      having: { hash: { _count: { gt: 1 } } },
      _count: { hash: true },
    });
    duplicateHashes = rows.map((r) => r.hash).filter(Boolean) as string[];
    if (duplicateHashes.length === 0) {
      return { items: [], total: 0, page, limit, totalPages: 0 };
    }
  }

  const where = buildWhere(opts.filters, duplicateHashes);

  const [items, total] = await Promise.all([
    prisma.mediaAsset.findMany({
      where,
      select:  ASSET_LIST_SELECT,
      orderBy,
      skip,
      take: limit,
    }),
    prisma.mediaAsset.count({ where }),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getMediaAssetById(id: string) {
  return prisma.mediaAsset.findUnique({
    where: { id },
    include: {
      variants:  { orderBy: [{ preset: 'asc' }, { format: 'asc' }] },
      usages:    { orderBy: { createdAt: 'desc' }, take: 50 },
      uploadedBy: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function countMediaAssets(filters: MediaListFilters = {}): Promise<number> {
  return prisma.mediaAsset.count({ where: buildWhere(filters) });
}

/** Minimal projection for SEO / sitemap generation — no variants. */
export interface MediaAssetSeo {
  id:           string;
  url:          string;
  thumbnailUrl: string | null;
  alt:          string | null;
  title:        string | null;
  seoTitle:     string | null;
  caption:      string | null;
  description:  string | null;
  keywords:     string[];
  width:        number | null;
  height:       number | null;
  mimeType:     string;
  createdAt:    Date;
  updatedAt:    Date;
}

export async function listMediaAssetsSeo(limit = 1000): Promise<MediaAssetSeo[]> {
  return prisma.mediaAsset.findMany({
    where:   { processingStatus: 'done' },
    orderBy: { createdAt: 'desc' },
    take:    limit,
    select: {
      id: true, url: true, thumbnailUrl: true, alt: true, title: true,
      seoTitle: true, caption: true, description: true, keywords: true,
      width: true, height: true, mimeType: true, createdAt: true, updatedAt: true,
    },
  });
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* SEO Health Dashboard                                                         */
/* ─────────────────────────────────────────────────────────────────────────── */

export interface SeoHealthStats {
  total:           number;
  missingAlt:      number;
  missingKeywords: number;
  noWebP:          number;
  noAvif:          number;
  oversized:       number;   // size > 200 KB
  noResponsive:    number;   // fewer than 4 variants
  unused:          number;
  duplicates:      number;
  lowScore:        number;   // optimizationScore < 60
  scoreAvg:        number;
}

export async function getSeoHealthStats(folder?: string): Promise<SeoHealthStats> {
  const base: Prisma.MediaAssetWhereInput = folder && folder !== 'all' ? { folder } : {};

  const OVERSIZE = 200 * 1024;

  const [total, missingAlt, missingKeywords, noWebP, noAvif, oversized, noResponsive, unused, lowScore, scoreSum, dupRows] =
    await Promise.all([
      prisma.mediaAsset.count({ where: base }),
      prisma.mediaAsset.count({ where: { ...base, OR: [{ alt: null }, { alt: '' }] } }),
      prisma.mediaAsset.count({ where: { ...base, keywords: { isEmpty: true } } }),
      prisma.mediaAsset.count({ where: { ...base, variants: { none: { format: 'webp' } } } }),
      prisma.mediaAsset.count({ where: { ...base, variants: { none: { format: 'avif' } } } }),
      prisma.mediaAsset.count({ where: { ...base, size: { gt: OVERSIZE } } }),
      prisma.mediaAsset.count({
        where: { ...base, NOT: { variants: { some: {} } } },
      }),
      prisma.mediaAsset.count({ where: { ...base, usages: { none: {} } } }),
      prisma.mediaAsset.count({ where: { ...base, optimizationScore: { lt: 60 } } }),
      prisma.mediaAsset.aggregate({ where: { ...base, optimizationScore: { not: null } }, _avg: { optimizationScore: true } }),
      prisma.mediaAsset.groupBy({
        by: ['hash'],
        where: { ...base, hash: { not: null } },
        having: { hash: { _count: { gt: 1 } } },
        _count: { hash: true },
      }),
    ]);

  return {
    total,
    missingAlt,
    missingKeywords,
    noWebP,
    noAvif,
    oversized,
    noResponsive,
    unused,
    duplicates: dupRows.length,
    lowScore,
    scoreAvg:   Math.round(scoreSum._avg.optimizationScore ?? 0),
  };
}

/** Folder facets — distinct values with counts for the gallery sidebar. */
export async function listMediaFolders(): Promise<{ folder: string; count: number }[]> {
  const rows = await prisma.mediaAsset.groupBy({
    by:      ['folder'],
    _count:  { folder: true },
    orderBy: { folder: 'asc' },
  });
  return rows.map((r) => ({ folder: r.folder, count: r._count.folder }));
}

/** Schedule an async transform job (reprocess, convert, etc.). */
export async function scheduleTransformJob(
  assetId: string,
  action: 'reprocess' | 'resize' | 'convert' | 'optimize',
  params?: Record<string, unknown>,
  priority = 0
): Promise<string> {
  const job = await prisma.mediaTransformJob.create({
    data: { assetId, action, params: (params ?? undefined) as Prisma.InputJsonValue | undefined, priority },
    select: { id: true },
  });
  return job.id;
}

/** Poll next pending job (used by the worker/cron). */
export async function claimNextTransformJob() {
  return prisma.$transaction(async (tx) => {
    const job = await tx.mediaTransformJob.findFirst({
      where:   { status: 'pending' },
      orderBy: [{ priority: 'asc' }, { scheduledAt: 'asc' }],
    });
    if (!job) return null;
    return tx.mediaTransformJob.update({
      where: { id: job.id },
      data:  { status: 'running', startedAt: new Date(), attempts: { increment: 1 } },
    });
  });
}
