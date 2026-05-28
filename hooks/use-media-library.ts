'use client';

/**
 * useMediaLibrary — central state + fetch logic for the enterprise media library.
 *
 * Handles: asset list with infinite-scroll, folder sidebar, advanced filters,
 * bulk selection, upload queue integration, SEO health stats, and all mutations.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/* ─── types (mirrored from server to avoid server-only imports) ─────────── */

export interface LibraryAsset {
  id:                string;
  filename:          string;
  originalName:      string;
  url:               string;
  thumbnailUrl?:     string | null;
  mimeType:          string;
  size:              number;
  width:             number | null;
  height:            number | null;
  alt:               string | null;
  title:             string | null;
  caption:           string | null;
  keywords:          string[];
  folder:            string;
  tags:              string[];
  context?:          string | null;
  createdAt:         string;
  updatedAt:         string;
  optimizationScore?:number | null;
  compressionRatio?: number | null;
  dominantColor?:    string | null;
  blurDataURL?:      string | null;
  processingStatus?: string;
  storageProvider?:  string;
  uploadedBy?:       { id: string; name: string } | null;
  variants:          { preset: string; format: string; url: string; width: number; height: number; size: number }[];
  _count:            { usages: number };
}

export interface FolderFacet { folder: string; count: number; }

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

export type SortKey = 'createdAt' | 'size' | 'optimizationScore' | 'originalName';
export type SortDir = 'asc' | 'desc';
export type ViewMode = 'grid' | 'list';

const PAGE_LIMIT = 40;

function buildParams(
  folder: string,
  q: string,
  sort: SortKey,
  dir: SortDir,
  page: number,
  mimeFilter: string,
  adv: AdvancedFilters,
  extras?: Record<string, string>,
): URLSearchParams {
  const p = new URLSearchParams({
    sort, dir,
    page:  String(page),
    limit: String(PAGE_LIMIT),
  });
  if (folder && folder !== 'all') p.set('folder', folder);
  if (q.trim()) p.set('q', q.trim());
  if (mimeFilter) p.set('mimeType', mimeFilter);
  if (adv.noAlt)      p.set('noAlt',      '1');
  if (adv.noWebP)     p.set('noWebP',     '1');
  if (adv.noAvif)     p.set('noAvif',     '1');
  if (adv.unused)     p.set('unused',     '1');
  if (adv.duplicates) p.set('duplicates', '1');
  if (adv.minSize !== undefined) p.set('minSize', String(adv.minSize));
  if (adv.maxSize !== undefined) p.set('maxSize', String(adv.maxSize));
  if (adv.minWidth !== undefined) p.set('minWidth', String(adv.minWidth));
  if (adv.maxWidth !== undefined) p.set('maxWidth', String(adv.maxWidth));
  if (adv.minScore !== undefined) p.set('minScore', String(adv.minScore));
  if (adv.maxScore !== undefined) p.set('maxScore', String(adv.maxScore));
  if (adv.processingStatus) p.set('processingStatus', adv.processingStatus);
  if (extras) Object.entries(extras).forEach(([k, v]) => p.set(k, v));
  return p;
}

/* ─── hook ──────────────────────────────────────────────────────────────── */

export function useMediaLibrary() {
  /* ── filter state ─────────────────────────────────────────────────── */
  const [folder,     setFolder]     = useState('all');
  const [q,          setQ]          = useState('');
  const [sort,       setSort]       = useState<SortKey>('createdAt');
  const [dir,        setDir]        = useState<SortDir>('desc');
  const [mimeFilter, setMimeFilter] = useState('');     // '' | 'image/' | 'video/'
  const [adv,        setAdv]        = useState<AdvancedFilters>({});

  /* ── data state ───────────────────────────────────────────────────── */
  const [assets,     setAssets]     = useState<LibraryAsset[]>([]);
  const [total,      setTotal]      = useState(0);
  const [hasMore,    setHasMore]    = useState(false);
  const [page,       setPage]       = useState(1);
  const [loading,    setLoading]    = useState(false);
  const [loadingMore,setLoadingMore]= useState(false);
  const [folders,    setFolders]    = useState<FolderFacet[]>([]);
  const [allFolders,  setAllFolders]  = useState<{ name: string; count: number; label: string | null; custom: boolean }[]>([]);
  const [seoHealth,  setSeoHealth]  = useState<SeoHealthStats | null>(null);

  /* ── selection state ──────────────────────────────────────────────── */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMode,    setBulkMode]    = useState(false);

  /* ── UI state ─────────────────────────────────────────────────────── */
  const [view,        setView]        = useState<ViewMode>('grid');
  const [activeAsset, setActiveAsset] = useState<LibraryAsset | null>(null);
  const [copied,      setCopied]      = useState<string | null>(null);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── load admin folder list (includes empty custom folders) ─────── */
  const loadAllFolders = useCallback(async () => {
    const res = await fetch('/api/admin/media/folders');
    if (!res.ok) return;
    const json = await res.json();
    setAllFolders(json.data ?? []);
  }, []);

  useEffect(() => { void loadAllFolders(); }, [loadAllFolders]);

  /* ── fetch ────────────────────────────────────────────────────────── */

  const fetchPage = useCallback(async (opts: {
    folder?: string; q?: string; sort?: SortKey; dir?: SortDir;
    mimeFilter?: string; adv?: AdvancedFilters;
    page?: number; replace?: boolean;
  } = {}) => {
    const f   = opts.folder     ?? folder;
    const s   = opts.q          ?? q;
    const sk  = opts.sort       ?? sort;
    const sd  = opts.dir        ?? dir;
    const mf  = opts.mimeFilter ?? mimeFilter;
    const av  = opts.adv        ?? adv;
    const pg  = opts.page       ?? 1;
    const replace = opts.replace ?? true;

    if (replace) setLoading(true);
    else         setLoadingMore(true);

    try {
      const params = buildParams(f, s, sk, sd, pg, mf, av,
        pg === 1 ? { includeFolders: '1', includeSeoHealth: '1' } : undefined,
      );
      const res  = await fetch(`/api/media?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      const items: LibraryAsset[] = json.data ?? [];
      if (replace) {
        setAssets(items);
      } else {
        setAssets((prev) => [...prev, ...items]);
      }
      setTotal(json.total ?? 0);
      setHasMore(pg < (json.totalPages ?? 1));
      setPage(pg);
      if (json.folders)   setFolders(json.folders);
      if (json.seoHealth) setSeoHealth(json.seoHealth);
    } catch (err) {
      console.error('[useMediaLibrary] fetch failed:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [folder, q, sort, dir, mimeFilter, adv]);

  /* initial load */
  useEffect(() => { void fetchPage(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── navigation helpers ───────────────────────────────────────────── */

  const changeFolder = (f: string) => {
    setFolder(f); setPage(1); clearSelection();
    void fetchPage({ folder: f, page: 1, replace: true });
  };

  const changeQ = (val: string) => {
    setQ(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      void fetchPage({ q: val, page: 1, replace: true });
    }, 350);
  };

  const changeSort = (sk: SortKey, sd: SortDir) => {
    setSort(sk); setDir(sd); setPage(1);
    void fetchPage({ sort: sk, dir: sd, page: 1, replace: true });
  };

  const changeMime = (mf: string) => {
    setMimeFilter(mf); setPage(1);
    void fetchPage({ mimeFilter: mf, page: 1, replace: true });
  };

  const changeAdv = (patch: Partial<AdvancedFilters>) => {
    const next = { ...adv, ...patch };
    setAdv(next); setPage(1);
    void fetchPage({ adv: next, page: 1, replace: true });
  };

  const clearAdv = () => {
    setAdv({}); setMimeFilter(''); setPage(1);
    void fetchPage({ adv: {}, mimeFilter: '', page: 1, replace: true });
  };

  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    const nextPage = page + 1;
    void fetchPage({ page: nextPage, replace: false });
  };

  const refresh = () => { void fetchPage({ page: 1, replace: true }); };

  /* ── selection ────────────────────────────────────────────────────── */

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const selectAll    = () => setSelectedIds(new Set(assets.map((a) => a.id)));
  const clearSelection = () => { setSelectedIds(new Set()); setBulkMode(false); };

  /* ── mutations ────────────────────────────────────────────────────── */

  const deleteOne = async (id: string): Promise<boolean> => {
    const res = await fetch(`/api/media/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setAssets((prev) => prev.filter((a) => a.id !== id));
      setTotal((n) => n - 1);
      if (activeAsset?.id === id) setActiveAsset(null);
    }
    return res.ok;
  };

  const bulkAction = async (
    action: 'delete' | 'move' | 'tag' | 'optimize' | 'regenerate',
    extra?: { folder?: string; tags?: string[]; replace?: boolean; force?: boolean; quality?: number },
  ) => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    const res = await fetch('/api/media/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ids, ...extra }),
    });
    if (res.ok) {
      clearSelection();
      refresh();
    }
    return res.ok;
  };

  const saveAsset = async (
    id: string,
    data: Partial<Pick<LibraryAsset, 'alt' | 'title' | 'caption' | 'originalName' | 'folder' | 'tags' | 'keywords'>>,
  ) => {
    const res = await fetch(`/api/media/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const { data: updated } = await res.json();
      setAssets((prev) => prev.map((a) => a.id === id ? { ...a, ...updated } : a));
      setActiveAsset((prev) => prev?.id === id ? { ...prev, ...updated } : prev);
    }
    return res.ok;
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(
      typeof window !== 'undefined' ? window.location.origin + url : url
    ).catch(() => navigator.clipboard.writeText(url));
    setCopied(url);
    setTimeout(() => setCopied(null), 2000);
  };

  /* ── create folder ────────────────────────────────────────────────── */

  const createFolder = async (name: string): Promise<void> => {
    const res = await fetch('/api/admin/media/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, label: name }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Error creating folder');
    await loadAllFolders();
    void fetchPage({ page: 1, replace: true });
    changeFolder(json.data?.name ?? name);
  };

  const deleteFolder = async (name: string): Promise<void> => {
    await fetch(`/api/admin/media/folders/${encodeURIComponent(name)}`, { method: 'DELETE' });
    await loadAllFolders();
    if (folder === name) changeFolder('all');
    else void fetchPage({ page: 1, replace: true });
  };

  const renameFolder = async (name: string, label: string): Promise<void> => {
    await fetch(`/api/admin/media/folders/${encodeURIComponent(name)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
    });
    await loadAllFolders();
    void fetchPage({ page: 1, replace: true });
  };

  /* ── expose ───────────────────────────────────────────────────────── */

  const advIsActive = Object.values(adv).some(Boolean) || !!mimeFilter;

  return {
    /* data */
    assets, total, hasMore, loading, loadingMore,
    folders, allFolders, seoHealth,
    /* filter state */
    folder, q, sort, dir, mimeFilter, adv, advIsActive,
    /* navigation */
    changeFolder, changeQ, changeSort, changeMime, changeAdv, clearAdv,
    loadMore, refresh,
    /* selection */
    selectedIds, bulkMode, setBulkMode, toggleSelect, selectAll, clearSelection,
    /* UI */
    view, setView, activeAsset, setActiveAsset, copied,
    /* mutations */
    deleteOne, bulkAction, saveAsset, copyUrl,
    createFolder, deleteFolder, renameFolder,
  };
}
