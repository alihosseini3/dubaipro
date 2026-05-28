'use client';

import Image from 'next/image';
import {
  type ChangeEvent, type DragEvent, useCallback, useEffect, useRef, useState,
} from 'react';
import { useTranslations } from 'next-intl';

import { UploadSettings, DEFAULT_UPLOAD_CONFIG, type UploadConfig } from '@/components/ui/UploadSettings';
import {
  MediaPreparingPanel,
  type PreparingSeoMeta,
} from '@/components/ui/MediaPreparingPanel';
import { MediaCard }         from '@/components/admin/media/MediaCard';
import { FolderSidebar }     from '@/components/admin/media/FolderSidebar';
import { MediaDetailsPanel } from '@/components/admin/media/MediaDetailsPanel';
import { UploadProgress, type UploadQueueItem } from '@/components/admin/media/UploadProgress';

/* â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

type MediaAsset = {
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
  optimizationScore?: number | null;
  dominantColor?: string | null;
  blurDataURL?: string | null;
  uploadedBy?: { name: string } | null;
};

type View = 'grid' | 'list';
type Sort = 'newest' | 'oldest' | 'name' | 'size';
type TypeFilter = 'all' | 'image' | 'video';

type FolderInfo = { name: string; count: number; label: string | null; custom: boolean };
type Folder = string;

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

const Ic = ({ d, className = 'h-4 w-4' }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d={d} />
  </svg>
);

/* â”€â”€â”€ Main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export function GalleryManager() {
  const t = useTranslations('admin.gallery');
  const [assets, setAssets]             = useState<MediaAsset[]>([]);
  const [total, setTotal]               = useState(0);
  const [totalPages, setTotalPages]     = useState(0);
  const [page, setPage]                 = useState(1);
  const [view, setView]                 = useState<View>('grid');
  const [folder, setFolder]             = useState<Folder>('all');
  const [folderList, setFolderList]     = useState<FolderInfo[]>([]);
  const [search, setSearch]             = useState('');
  const [sort, setSort]                 = useState<Sort>('newest');
  const [typeFilter, setTypeFilter]     = useState<TypeFilter>('all');
  const [isLoading, setIsLoading]       = useState(false);
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode]         = useState(false);
  const [activeAsset, setActiveAsset]   = useState<MediaAsset | null>(null);
  const [isDragging, setIsDragging]     = useState(false);
  const [uploadQueue, setUploadQueue]   = useState<UploadQueueItem[]>([]);
  const [isUploading, setIsUploading]   = useState(false);
  const [prepQueue, setPrepQueue]       = useState<File[]>([]);
  const [copied, setCopied]             = useState<string | null>(null);
  const [uploadConfig, setUploadConfig] = useState<UploadConfig>(DEFAULT_UPLOAD_CONFIG);
  const [bulkMoveTarget, setBulkMoveTarget] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadFolders = useCallback(() => {
    fetch('/api/admin/media/folders').then((r) => r.json()).then((j) => setFolderList(j.data ?? []));
  }, []);

  useEffect(() => { loadFolders(); }, [loadFolders]);

  /* â”€â”€ Create folder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  const createFolder = async (name: string) => {
    const res = await fetch('/api/admin/media/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, label: name }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Error');
    loadFolders();
    changeFolder(json.data.name);
  };

  const deleteFolder = async (name: string) => {
    const res = await fetch(`/api/admin/media/folders/${encodeURIComponent(name)}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) { alert(json.error); return; }
    loadFolders();
    if (folder === name) changeFolder('all');
  };

  const renameFolder = async (name: string, newLabel: string) => {
    await fetch(`/api/admin/media/folders/${encodeURIComponent(name)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: newLabel }),
    });
    loadFolders();
  };

  /* â”€â”€ Fetch â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  const load = useCallback(async (opts?: {
    folder?: Folder; search?: string; sort?: Sort; page?: number; typeFilter?: TypeFilter;
  }) => {
    setIsLoading(true);
    const f  = opts?.folder     ?? folder;
    const s  = opts?.search     ?? search;
    const o  = opts?.sort       ?? sort;
    const p  = opts?.page       ?? page;
    const tf = opts?.typeFilter ?? typeFilter;
    const params = new URLSearchParams({ folder: f, search: s, sort: o, page: String(p) });
    if (tf === 'image') params.set('mime', 'image');
    if (tf === 'video') params.set('mime', 'video');
    try {
      const res  = await fetch(`/api/admin/media?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.data) {
        setAssets(json.data);
        setTotal(json.total ?? 0);
        setTotalPages(json.totalPages ?? 1);
      }
    } catch (err) {
      console.error('[GalleryManager] load failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [folder, search, sort, page, typeFilter]);

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* â”€â”€ Search debounce â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  const onSearchChange = (val: string) => {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setPage(1); void load({ search: val, page: 1 }); }, 350);
  };

  /* â”€â”€ Navigation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const changeFolder = (f: Folder)     => { setFolder(f);     setPage(1); void load({ folder: f,         page: 1 }); };
  const changeSort   = (s: Sort)       => { setSort(s);       setPage(1); void load({ sort: s,           page: 1 }); };
  const changePage   = (p: number)     => { setPage(p);                   void load({ page: p }); };
  const changeType   = (tf: TypeFilter)=> { setTypeFilter(tf); setPage(1); void load({ typeFilter: tf,   page: 1 }); };

  /* â”€â”€ Upload â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  /**
   * Send a single image to `/api/media/upload` AFTER the user confirmed
   * SEO metadata in the prep panel. Reused for every queued image.
   */
  const runImageUpload = useCallback(
    async (f: File, seo: PreparingSeoMeta, cfg: UploadConfig) => {
      const queueIdx = uploadQueue.findIndex((q) => q.name === f.name && !q.done && !q.error);
      const fd = new FormData();
      fd.append('file', f);
      fd.append('folder', folder === 'all' ? 'general' : folder);
      fd.append('quality', String(cfg.quality));
      if (seo.alt)     fd.append('alt',     seo.alt);
      if (seo.title)   fd.append('title',   seo.title);
      if (seo.caption) fd.append('caption', seo.caption);
      try {
        const res = await fetch('/api/media/upload', { method: 'POST', body: fd });
        if (!res.ok) throw new Error('Upload failed');
        const json = await res.json();
        const ratio = json.data?.compressionRatio as number | undefined;
        const fmt   = json.data?.mimeType         as string | undefined;
        const pct   = ratio !== undefined ? Math.round(ratio * 100) : undefined;
        const label = pct !== undefined
          ? `${pct > 0 ? `â†“${pct}%` : 'done'} â†’ ${fmt?.split('/')[1] ?? ''}`
          : '';
        setUploadQueue((q) => q.map((item, idx) => idx === queueIdx ? { ...item, done: true, label } : item));
      } catch {
        setUploadQueue((q) => q.map((item, idx) => idx === queueIdx ? { ...item, error: 'Failed' } : item));
      }
    },
    [folder, uploadQueue],
  );

  /** Videos bypass the SEO prep panel â€” upload them straight away. */
  const runVideoUpload = useCallback(
    async (f: File) => {
      const queueIdx = uploadQueue.findIndex((q) => q.name === f.name && !q.done && !q.error);
      const fd = new FormData();
      fd.append('file', f);
      fd.append('folder', folder === 'all' ? 'general' : folder);
      try {
        const res = await fetch('/api/media/upload', { method: 'POST', body: fd });
        if (!res.ok) throw new Error('Upload failed');
        setUploadQueue((q) => q.map((item, idx) => idx === queueIdx ? { ...item, done: true, label: '' } : item));
      } catch {
        setUploadQueue((q) => q.map((item, idx) => idx === queueIdx ? { ...item, error: 'Failed' } : item));
      }
    },
    [folder, uploadQueue],
  );

  /**
   * Picking files no longer uploads images immediately â€” they are queued
   * so SEO metadata is captured BEFORE the network call. Videos still
   * upload right away (they have no SEO surface in the pipeline).
   */
  const uploadFiles = useCallback((files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    setIsUploading(true);
    setUploadQueue((prev) => [...prev, ...list.map((f) => ({ name: f.name, done: false }))]);

    const images: File[] = [];
    const videos: File[] = [];
    for (const f of list) (f.type.startsWith('video/') ? videos : images).push(f);

    if (images.length > 0) setPrepQueue((q) => [...q, ...images]);
    for (const v of videos) void runVideoUpload(v);
  }, [runVideoUpload]);

  const onFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) uploadFiles(e.target.files);
    e.target.value = '';
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) uploadFiles(e.dataTransfer.files);
  };

  /** User confirmed SEO for the head-of-queue file â†’ fire the upload. */
  const confirmPrep = useCallback(
    async (seo: PreparingSeoMeta, cfg: UploadConfig) => {
      const file = prepQueue[0];
      if (!file) return;
      setPrepQueue((q) => q.slice(1));
      await runImageUpload(file, seo, cfg);
    },
    [prepQueue, runImageUpload],
  );

  const cancelPrep = useCallback(() => {
    const file = prepQueue[0];
    if (!file) return;
    setPrepQueue((q) => q.slice(1));
    // Drop the matching queue row â€” the user explicitly aborted it.
    setUploadQueue((q) => {
      const idx = q.findIndex((row) => row.name === file.name && !row.done && !row.error);
      if (idx === -1) return q;
      const next = q.slice();
      next.splice(idx, 1);
      return next;
    });
  }, [prepQueue]);

  /**
   * When all in-flight work is done, refresh the grid + folders.
   * Tracked via the uploadQueue + prepQueue â€” we settle when both
   * the prep queue is empty and every queued row is done/failed.
   */
  useEffect(() => {
    if (uploadQueue.length === 0) { setIsUploading(false); return; }
    const allSettled = uploadQueue.every((q) => q.done || q.error);
    if (allSettled && prepQueue.length === 0) {
      setIsUploading(false);
      const t = setTimeout(() => setUploadQueue([]), 3000);
      setPage(1);
      load({ page: 1 });
      loadFolders();
      return () => clearTimeout(t);
    }
  }, [uploadQueue, prepQueue]); // eslint-disable-line react-hooks/exhaustive-deps

  /* â”€â”€ Selection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll   = () => setSelectedIds(new Set(assets.map((a) => a.id)));
  const clearSelect = () => { setSelectedIds(new Set()); setBulkMode(false); };

  /* â”€â”€ Delete â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  const deleteOne = async (id: string) => {
    if (!confirm(t('deleteConfirm'))) return;
    await fetch(`/api/admin/media/${id}`, { method: 'DELETE' });
    if (activeAsset?.id === id) setActiveAsset(null);
    void load();
  };

  const deleteBulk = async () => {
    if (!confirm(t('deleteBulkConfirm', { n: selectedIds.size }))) return;
    await fetch('/api/media/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', ids: [...selectedIds] }),
    });
    clearSelect();
    void load();
  };

  const moveBulk = async (targetFolder: string) => {
    if (!targetFolder) return;
    await fetch('/api/media/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'move', ids: [...selectedIds], folder: targetFolder }),
    });
    clearSelect();
    setBulkMoveTarget('');
    void load();
    loadFolders();
  };

  /* â”€â”€ Copy URL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(window.location.origin + url).catch(() => {
      navigator.clipboard.writeText(url);
    });
    setCopied(url);
    setTimeout(() => setCopied(null), 2000);
  };

  /* â”€â”€ Save edit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  const saveEdit = async (data: Partial<Pick<MediaAsset, 'alt' | 'title' | 'caption' | 'originalName' | 'folder' | 'tags' | 'keywords'>>) => {
    if (!activeAsset) return;
    const res = await fetch(`/api/admin/media/${activeAsset.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const { data: updated } = await res.json();
      setAssets((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));
      setActiveAsset((prev) => (prev ? { ...prev, ...updated } : null));
    }
  };

  const folderNames = folderList.map((f) => f.name);

  /* â”€â”€â”€ RENDER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  return (
    <div className="flex h-full min-h-[80vh] overflow-hidden rounded-2xl border border-slate-200 bg-[#F8FAFC] shadow-sm">

      {/* â”€â”€ Folder sidebar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <FolderSidebar
        folder={folder}
        folderList={folderList}
        total={total}
        onChangeFolder={changeFolder}
        onCreateFolder={createFolder}
        onDeleteFolder={deleteFolder}
        onRenameFolder={renameFolder}
      />

      {/* â”€â”€ Main area â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex min-w-0 flex-1 flex-col">

        {/* Header */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
          <div className="flex flex-1 items-center gap-2 min-w-0">
            <h1 className="text-base font-bold text-[#0F172A]">{t('title')}</h1>
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">{total}</span>
          </div>
          <UploadSettings value={uploadConfig} onChange={setUploadConfig} />
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading}
            className="flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 active:scale-95 disabled:opacity-60">
            <Ic d="M4 16v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1M12 12V4m0 0-3 3m3-3 3 3" className="h-4 w-4" />
            {t('uploadBtn')}
          </button>
          <input ref={fileInputRef} type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm,video/quicktime"
            multiple className="hidden" onChange={onFileInput} />
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2.5">
          <div className="relative flex-1 min-w-[140px]">
            <span className="pointer-events-none absolute inset-y-0 start-2.5 flex items-center text-slate-400">
              <Ic d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" className="h-3.5 w-3.5" />
            </span>
            <input type="text" value={search} onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full rounded-xl border border-slate-200 bg-white py-1.5 ps-7 pe-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
          </div>

          <div className="flex rounded-xl border border-slate-200 bg-white p-0.5">
            {(['all', 'image', 'video'] as TypeFilter[]).map((tf) => (
              <button key={tf} type="button" onClick={() => changeType(tf)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${typeFilter === tf ? 'bg-[#0F172A] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                {t(tf === 'all' ? 'filterAll' : tf === 'image' ? 'filterImages' : 'filterVideos')}
              </button>
            ))}
          </div>

          <select value={sort} onChange={(e) => changeSort(e.target.value as Sort)}
            className="rounded-xl border border-slate-200 bg-white py-1.5 ps-2.5 pe-7 text-sm text-slate-700 outline-none focus:border-orange-400">
            <option value="newest">{t('sortNewest')}</option>
            <option value="oldest">{t('sortOldest')}</option>
            <option value="name">{t('sortName')}</option>
            <option value="size">{t('sortSize')}</option>
          </select>

          <div className="flex rounded-xl border border-slate-200 bg-white p-0.5">
            <button type="button" onClick={() => setView('grid')}
              className={`rounded-lg p-1.5 transition ${view === 'grid' ? 'bg-[#0F172A] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
              <Ic d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => setView('list')}
              className={`rounded-lg p-1.5 transition ${view === 'list' ? 'bg-[#0F172A] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
              <Ic d="M4 6h16M4 10h16M4 14h16M4 18h16" className="h-3.5 w-3.5" />
            </button>
          </div>

          <button type="button"
            onClick={() => { setBulkMode((v) => !v); if (bulkMode) clearSelect(); }}
            className={`rounded-xl border px-3 py-1.5 text-sm font-medium transition ${bulkMode ? 'border-orange-300 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
            {t('selectMode')}
          </button>

          <select value={folder} onChange={(e) => changeFolder(e.target.value as Folder)}
            className="rounded-xl border border-slate-200 bg-white py-1.5 ps-2.5 pe-7 text-sm text-slate-700 outline-none lg:hidden">
            <option value="all">{t('folderAll')}</option>
            {folderList.map((f) => <option key={f.name} value={f.name}>{f.label || f.name}</option>)}
          </select>
        </div>

        {/* Upload progress */}
        <UploadProgress queue={uploadQueue} />

        {/* SEO prep modal */}
        {prepQueue[0] && (
          <MediaPreparingPanel
            key={`${prepQueue[0].name}-${prepQueue[0].size}-${prepQueue[0].lastModified}`}
            file={prepQueue[0]}
            context="general"
            queuePosition={prepQueue.length > 1 ? { index: 1, total: prepQueue.length } : undefined}
            onUpload={confirmPrep}
            onCancel={cancelPrep}
          />
        )}

        {/* Bulk actions bar */}
        {bulkMode && (
          <div className="flex flex-wrap items-center gap-2 border-b border-orange-200 bg-orange-50/80 px-4 py-2">
            <span className="text-sm font-semibold text-orange-700">{t('selectedCount', { n: selectedIds.size })}</span>
            <button type="button" onClick={selectAll} className="text-xs text-slate-600 hover:text-orange-600 hover:underline">{t('selectAll', { n: assets.length })}</button>
            <button type="button" onClick={clearSelect} className="text-xs text-slate-500 hover:underline">{t('clearSelection')}</button>
            <div className="flex-1" />
            {selectedIds.size > 0 && (
              <>
                <div className="flex items-center gap-1">
                  <select value={bulkMoveTarget} onChange={(e) => setBulkMoveTarget(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white py-1.5 ps-2.5 pe-7 text-xs text-slate-700 outline-none focus:border-orange-400">
                    <option value="">{t('bulkMove')}</option>
                    {folderList.map((f) => <option key={f.name} value={f.name}>{f.label || f.name}</option>)}
                  </select>
                  {bulkMoveTarget && (
                    <button type="button" onClick={() => void moveBulk(bulkMoveTarget)}
                      className="rounded-lg bg-[#0F172A] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800">
                      {t('bulkMoveConfirm')}
                    </button>
                  )}
                </div>
                <button type="button" onClick={() => void deleteBulk()}
                  className="flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700">
                  <Ic d="M3 6h18M8 6V4h8v2M19 6v14H5V6" className="h-3.5 w-3.5" />
                  {t('bulkDelete', { n: selectedIds.size })}
                </button>
              </>
            )}
          </div>
        )}

        {/* Drop zone + content */}
        <div className="relative flex-1 overflow-y-auto"
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}>

          {/* Drag overlay */}
          {isDragging && (
            <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-orange-500/10 backdrop-blur-sm">
              <div className="rounded-3xl border-2 border-dashed border-orange-500 bg-white/90 px-16 py-12 text-center shadow-2xl">
                <Ic d="M4 16v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1M12 12V4m0 0-3 3m3-3 3 3" className="mx-auto mb-4 h-12 w-12 text-orange-500" />
                <p className="text-xl font-bold text-orange-700">{t('uploadDrop')}</p>
                <p className="mt-1 text-sm text-orange-500">{t('uploadDropSub')}</p>
              </div>
            </div>
          )}

          {/* Loading skeleton */}
          {isLoading && assets.length === 0 && (
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {Array.from({ length: 18 }).map((_, i) => (
                <div key={i} className="flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white">
                  <div className="aspect-square animate-pulse bg-slate-200" />
                  <div className="space-y-1.5 p-2.5">
                    <div className="h-2.5 w-3/4 animate-pulse rounded bg-slate-200" />
                    <div className="h-2 w-1/2 animate-pulse rounded bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && assets.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-5 py-32 text-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-slate-100">
                <Ic d="M4 16l4-4 4 4 4-8 4 8M3 3h18v14H3z" className="h-10 w-10 text-slate-300" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-800">{search ? t('emptySearchTitle') : t('emptyTitle')}</p>
                <p className="mt-1.5 max-w-xs text-sm text-slate-500">{search ? t('emptySearchSubtitle') : t('emptySubtitle')}</p>
              </div>
              {!search && (
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="mt-1 rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 active:scale-95">
                  {t('emptyButton')}
                </button>
              )}
            </div>
          )}

          {/* Grid view */}
          {!isLoading && assets.length > 0 && view === 'grid' && (
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {assets.map((asset) => (
                <MediaCard
                  key={asset.id}
                  asset={asset}
                  selected={selectedIds.has(asset.id)}
                  active={activeAsset?.id === asset.id}
                  bulkMode={bulkMode}
                  copied={copied}
                  onSelect={() => toggleSelect(asset.id)}
                  onOpen={() => { setActiveAsset(asset); if (bulkMode) setBulkMode(false); }}
                  onEdit={() => { setActiveAsset(asset); if (bulkMode) setBulkMode(false); }}
                  onCopy={() => copyUrl(asset.url)}
                  onDelete={() => void deleteOne(asset.id)}
                />
              ))}
            </div>
          )}

          {/* List view */}
          {!isLoading && assets.length > 0 && view === 'list' && (
            <table className="w-full text-sm">
              <thead className="sticky top-0 border-b border-slate-200 bg-white">
                <tr>
                  {bulkMode && <th className="w-8 py-3 ps-4" />}
                  <th className="py-3 ps-4 text-start text-xs font-semibold uppercase tracking-wider text-slate-500">{t('detailFilename')}</th>
                  <th className="hidden py-3 px-4 text-start text-xs font-semibold uppercase tracking-wider text-slate-500 sm:table-cell">{t('detailFolder')}</th>
                  <th className="hidden py-3 px-4 text-start text-xs font-semibold uppercase tracking-wider text-slate-500 md:table-cell">{t('detailSize')}</th>
                  <th className="hidden py-3 px-4 text-start text-xs font-semibold uppercase tracking-wider text-slate-500 lg:table-cell">{t('detailUploaded')}</th>
                  <th className="py-3 pe-4 text-end text-xs font-semibold uppercase tracking-wider text-slate-500">{t('listActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assets.map((asset) => (
                  <tr key={asset.id}
                    onClick={() => setActiveAsset(asset)}
                    className={`cursor-pointer transition hover:bg-slate-50 ${selectedIds.has(asset.id) ? 'bg-orange-50' : activeAsset?.id === asset.id ? 'bg-orange-50/60' : ''}`}>
                    {bulkMode && (
                      <td className="ps-4 py-2.5">
                        <input type="checkbox" checked={selectedIds.has(asset.id)}
                          onChange={() => toggleSelect(asset.id)}
                          className="h-4 w-4 rounded border-slate-300 accent-orange-500" />
                      </td>
                    )}
                    <td className="py-2.5 ps-4">
                      <div className="flex items-center gap-3">
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
                          {asset.mimeType.startsWith('video/') ? (
                            <span className="absolute inset-0 flex items-center justify-center">
                              <Ic d="M5 3l14 9-14 9V3z" className="h-4 w-4 text-white translate-x-0.5" />
                            </span>
                          ) : (
                            <Image src={asset.thumbnailUrl || asset.url} alt={asset.alt || asset.originalName}
                              fill className="object-cover" sizes="40px" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate max-w-[180px] text-xs font-medium text-slate-800">{asset.originalName}</p>
                          {asset.alt && <p className="truncate max-w-[180px] text-[11px] text-slate-400">{asset.alt}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-2.5 text-xs text-slate-500 capitalize sm:table-cell">{asset.folder}</td>
                    <td className="hidden px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap md:table-cell">{fmtSize(asset.size)}</td>
                    <td className="hidden px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap lg:table-cell">{fmtDate(asset.createdAt)}</td>
                    <td className="py-2.5 pe-4">
                      <div className="flex items-center justify-end gap-1">
                        <TblBtn title={copied === asset.url ? t('copied') : t('copyUrl')}
                          onClick={(e) => { e.stopPropagation(); copyUrl(asset.url); }}>
                          {copied === asset.url
                            ? <Ic d="M20 6L9 17l-5-5" className="h-3.5 w-3.5 text-emerald-600" />
                            : <Ic d="M8 17.9H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2M10 8h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z" className="h-3.5 w-3.5" />}
                        </TblBtn>
                        <TblBtn title={t('editDetails')} onClick={(e) => { e.stopPropagation(); setActiveAsset(asset); }}>
                          <Ic d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" className="h-3.5 w-3.5" />
                        </TblBtn>
                        <TblBtn title={t('delete')} onClick={(e) => { e.stopPropagation(); void deleteOne(asset.id); }} danger>
                          <Ic d="M3 6h18M8 6V4h8v2M19 6v14H5V6" className="h-3.5 w-3.5" />
                        </TblBtn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 border-t border-slate-100 py-4">
              <PageBtn disabled={page <= 1} onClick={() => changePage(page - 1)}>â€¹</PageBtn>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce<(number | 'â€¦')[]>((acc, p, i, arr) => {
                  if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('â€¦');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === 'â€¦'
                    ? <span key={`e${i}`} className="px-1 text-slate-400">â€¦</span>
                    : <PageBtn key={p} active={page === p} onClick={() => changePage(p as number)}>{p}</PageBtn>
                )}
              <PageBtn disabled={page >= totalPages} onClick={() => changePage(page + 1)}>â€º</PageBtn>
            </div>
          )}
        </div>
      </div>

      {/* Details panel */}
      {activeAsset && !bulkMode && (
        <MediaDetailsPanel
          asset={activeAsset}
          copied={copied}
          folderOptions={folderNames}
          onClose={() => setActiveAsset(null)}
          onCopy={() => copyUrl(activeAsset.url)}
          onDelete={() => void deleteOne(activeAsset.id)}
          onSave={saveEdit}
        />
      )}
    </div>
  );
}

/* â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function PageBtn({ children, onClick, disabled, active }: {
  children: React.ReactNode; onClick(): void; disabled?: boolean; active?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`flex h-8 min-w-8 items-center justify-center rounded-xl border px-2 text-sm font-medium transition ${
        active ? 'border-[#0F172A] bg-[#0F172A] text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40'
      }`}>
      {children}
    </button>
  );
}

function TblBtn({ children, onClick, title, danger }: {
  children: React.ReactNode; onClick(e: React.MouseEvent): void; title?: string; danger?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} title={title}
      className={`rounded-lg p-1.5 transition ${danger ? 'text-red-400 hover:bg-red-50 hover:text-red-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}>
      {children}
    </button>
  );
}
