/**
 * GET /api/media
 *
 * Paginated, filterable gallery list for the admin UI.
 *
 * Query params:
 *   q            — full-text search (originalName, alt, title, keywords)
 *   folder       — exact folder label
 *   context      — MediaContext key
 *   mimeType     — prefix match (e.g. "image/")
 *   tags         — comma-separated tag list (hasSome)
 *   processingStatus — done | pending | failed
 *   storageProvider  — local | s3 | r2
 *   uploadedById — filter by uploader
 *   page         — 1-indexed (default 1)
 *   limit        — per page 1-200 (default 40)
 *   sort         — createdAt | size | optimizationScore | originalName
 *   dir          — asc | desc (default desc)
 */

import { NextResponse } from 'next/server';

import { handlePrismaError } from '@/lib/api/errors';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import { isMediaContext } from '@/lib/media';
import {
  getSeoHealthStats,
  listMediaAssets,
  listMediaFolders,
  type MediaListFilters,
  type MediaSortKey,
  type SortDir,
} from '@/lib/media/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_SORT_KEYS = new Set<MediaSortKey>([
  'createdAt', 'size', 'optimizationScore', 'originalName',
]);

const VALID_SORT_DIRS = new Set<SortDir>(['asc', 'desc']);

export async function GET(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);

  const filters: MediaListFilters = {};

  const q = searchParams.get('q');
  if (q?.trim()) filters.q = q.trim();

  const folder = searchParams.get('folder');
  if (folder?.trim()) filters.folder = folder.trim();

  const ctxRaw = searchParams.get('context');
  if (ctxRaw && isMediaContext(ctxRaw)) filters.context = ctxRaw;

  const mimeType = searchParams.get('mimeType');
  if (mimeType?.trim()) filters.mimeType = mimeType.trim();

  const tagsRaw = searchParams.get('tags');
  if (tagsRaw) {
    const tags = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean);
    if (tags.length) filters.tags = tags;
  }

  const ps = searchParams.get('processingStatus');
  if (ps) filters.processingStatus = ps;

  const sp = searchParams.get('storageProvider');
  if (sp) filters.storageProvider = sp;

  const uid = searchParams.get('uploadedById');
  if (uid) filters.uploadedById = uid;

  /* ── Advanced filters ─────────────────────────────────────────────── */
  if (searchParams.get('noAlt')     === '1') filters.noAlt     = true;
  if (searchParams.get('noWebP')    === '1') filters.noWebP    = true;
  if (searchParams.get('noAvif')    === '1') filters.noAvif    = true;
  if (searchParams.get('unused')    === '1') filters.unused    = true;
  if (searchParams.get('duplicates')=== '1') filters.duplicates= true;

  const minSize = searchParams.get('minSize');
  if (minSize) filters.minSize = parseInt(minSize, 10);
  const maxSize = searchParams.get('maxSize');
  if (maxSize) filters.maxSize = parseInt(maxSize, 10);
  const minWidth = searchParams.get('minWidth');
  if (minWidth) filters.minWidth = parseInt(minWidth, 10);
  const maxWidth = searchParams.get('maxWidth');
  if (maxWidth) filters.maxWidth = parseInt(maxWidth, 10);
  const minScore = searchParams.get('minScore');
  if (minScore) filters.minScore = parseInt(minScore, 10);
  const maxScore = searchParams.get('maxScore');
  if (maxScore) filters.maxScore = parseInt(maxScore, 10);

  const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1', 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '40', 10) || 40));

  const sortRaw = searchParams.get('sort') ?? 'createdAt';
  const dirRaw  = searchParams.get('dir')  ?? 'desc';
  const sortKey: MediaSortKey = VALID_SORT_KEYS.has(sortRaw as MediaSortKey) ? (sortRaw as MediaSortKey) : 'createdAt';
  const sortDir: SortDir      = VALID_SORT_DIRS.has(dirRaw as SortDir)       ? (dirRaw  as SortDir)      : 'desc';

  const includeFolders   = searchParams.get('includeFolders')   === '1';
  const includeSeoHealth = searchParams.get('includeSeoHealth') === '1';

  try {
    const [result, folders, seoHealth] = await Promise.all([
      listMediaAssets({ filters, pagination: { page, limit }, sort: { key: sortKey, dir: sortDir } }),
      includeFolders   ? listMediaFolders()                             : Promise.resolve(undefined),
      includeSeoHealth ? getSeoHealthStats(filters.folder)              : Promise.resolve(undefined),
    ]);

    return NextResponse.json({
      data:       result.items,
      total:      result.total,
      page:       result.page,
      limit:      result.limit,
      totalPages: result.totalPages,
      ...(folders   !== undefined && { folders }),
      ...(seoHealth !== undefined && { seoHealth }),
    });
  } catch (error) {
    return handlePrismaError(error, 'GET /api/media');
  }
}
