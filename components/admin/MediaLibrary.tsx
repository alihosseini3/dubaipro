'use client';

/**
 * MediaLibrary — P5 enterprise-grade media library.
 *
 * Replaces GalleryManager. Drives the /admin/gallery page.
 * Uses: useMediaLibrary hook, useUploadQueue (P4), IntersectionObserver for infinite scroll.
 */

import { SmartImage } from '@/components/ui/SmartImage';
import {
  type ChangeEvent, type DragEvent, useCallback, useEffect, useRef, useState,
} from 'react';
import { useTranslations } from 'next-intl';

import { useMediaLibrary }        from '@/hooks/use-media-library';
import type { LibraryAsset }      from '@/hooks/use-media-library';
import { FolderSidebar }          from '@/components/admin/media/FolderSidebar';
import { AdvancedFilters }        from '@/components/admin/media/AdvancedFilters';
import { BulkActionsBar }         from '@/components/admin/media/BulkActionsBar';
import { AssetDetailPanel }       from '@/components/admin/media/AssetDetailPanel';
import { SeoHealthDashboard }       from '@/components/admin/media/SeoHealthDashboard';
import { MediaAnalyticsDashboard }  from '@/components/admin/media/MediaAnalyticsDashboard';
import { MediaToolsPanel }          from '@/components/admin/media/MediaToolsPanel';
import { UploadProgress, type UploadQueueItem } from '@/components/admin/media/UploadProgress';
import { MediaPreparingPanel, type PreparingSeoMeta } from '@/components/ui/MediaPreparingPanel';
import { UploadSettings, DEFAULT_UPLOAD_CONFIG, type UploadConfig } from '@/components/ui/UploadSettings';
import type { MediaAsset, FolderInfo } from '@/components/admin/media/types';
import { fmtSize } from '@/components/admin/media/types';

/* ─── icon helper ─────────────────────────────────────────────────────────── */
const Ic = ({ d, className = 'h-4 w-4' }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d={d} />
  </svg>
);

/* ─── score badge ─────────────────────────────────────────────────────────── */
function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (score == null || score >= 70) return null;
  return (
    <span className={`absolute right-2 top-8 z-10 rounded-lg px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm
      ${score < 40 ? 'bg-red-500/90' : 'bg-amber-500/90'}`}>
      {score}
    </span>
  );
}

/* ─── media card ──────────────────────────────────────────────────────────── */
function LibraryCard({
  asset, selected, active, bulkMode, copied, onSelect, onOpen, onCopy, onDelete,
}: {
  asset: LibraryAsset; selected: boolean; active: boolean; bulkMode: boolean;
  copied: string | null;
  onSelect(): void; onOpen(): void; onCopy(): void; onDelete(): void;
}) {
  const isVideo = asset.mimeType.startsWith('video/');
  const ext     = asset.mimeType.split('/')[1]?.toUpperCase().slice(0, 4) ?? 'IMG';

  return (
    <div className={`group relative flex flex-col overflow-hidden rounded-2xl border-2 bg-white shadow-sm transition-all duration-200 cursor-pointer
      ${active   ? 'border-orange-500 shadow-lg ring-2 ring-orange-200'
      : selected ? 'border-orange-400 shadow-md'
      : 'border-slate-100 hover:border-slate-300 hover:shadow-md'}`}>
      {/* Checkbox */}
      <button type="button" onClick={(e) => { e.stopPropagation(); onSelect(); }}
        className={`absolute left-2 top-2 z-20 flex h-5 w-5 items-center justify-center rounded-md border-2 shadow-sm transition-all
          ${selected || bulkMode ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
          ${selected ? 'border-orange-500 bg-orange-500' : 'border-white/90 bg-white/80 hover:border-orange-400'}`}
        aria-label="Select">
        {selected && <Ic d="M20 6L9 17l-5-5" className="h-3 w-3 text-white" />}
      </button>

      {/* Type badge */}
      <span className={`absolute right-2 top-2 z-10 rounded-lg px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide backdrop-blur-sm
        ${isVideo ? 'bg-violet-600/80 text-white' : 'bg-slate-900/65 text-white/90'}`}>
        {isVideo ? 'VID' : ext}
      </span>

      <ScoreBadge score={asset.optimizationScore} />

      {/* Thumbnail */}
      <div role="button" tabIndex={0}
        onClick={bulkMode ? onSelect : onOpen}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (bulkMode ? onSelect() : onOpen())}
        className="relative block aspect-square w-full cursor-pointer overflow-hidden bg-slate-900">
        {isVideo ? (
          <>
            <video src={asset.url} muted preload="metadata"
              className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105" />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm">
                <Ic d="M5 3l14 9-14 9V3z" className="h-5 w-5 translate-x-0.5" />
              </span>
            </span>
          </>
        ) : (
          <SmartImage
            src={asset.thumbnailUrl || asset.url}
            alt={asset.alt || asset.originalName}
            thumbnailUrl={asset.thumbnailUrl || undefined}
            sizes="(max-width:640px) 45vw, (max-width:1024px) 22vw, 16vw"
            className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
            style={asset.dominantColor ? { backgroundColor: asset.dominantColor } : undefined}
          />
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
          <OverlayBtn title={copied === asset.url ? 'Copied!' : 'Copy URL'} onClick={(e) => { e.stopPropagation(); onCopy(); }}>
            {copied === asset.url
              ? <Ic d="M20 6L9 17l-5-5" className="h-4 w-4 text-emerald-400" />
              : <Ic d="M8 17.9H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2M10 8h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z" className="h-4 w-4" />}
          </OverlayBtn>
          <OverlayBtn title="Delete" onClick={(e) => { e.stopPropagation(); onDelete(); }} danger>
            <Ic d="M3 6h18M8 6V4h8v2M19 6v14H5V6" className="h-4 w-4" />
          </OverlayBtn>
        </div>
      </div>

      {/* Footer */}
      <div className="px-2.5 py-2">
        <p className="truncate text-[11px] font-medium text-slate-800">{asset.originalName}</p>
        <p className="mt-0.5 text-[10px] text-slate-400">
          {asset.width && asset.height ? `${asset.width}×${asset.height} · ` : ''}
          {fmtSize(asset.size)}
        </p>
      </div>
    </div>
  );
}

function OverlayBtn({ children, onClick, title, danger }: {
  children: React.ReactNode; onClick(e: React.MouseEvent): void; title?: string; danger?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} title={title}
      className={`flex h-8 w-8 items-center justify-center rounded-xl backdrop-blur-sm transition
        ${danger ? 'bg-red-500/80 text-white hover:bg-red-600' : 'bg-white/20 text-white hover:bg-white/30'}`}>
      {children}
    </button>
  );
}

/* ─── adapters: LibraryAsset ↔ types.ts MediaAsset ──────────────────────── */
function toMediaAsset(a: LibraryAsset): MediaAsset {
  return {
    ...a,
    updatedAt: a.updatedAt ?? a.createdAt,
    variants:  a.variants ?? [],
    _count:    a._count ?? { usages: 0 },
  } as unknown as MediaAsset;
}

/* ─── main ────────────────────────────────────────────────────────────────── */
export function MediaLibrary() {
  const lib = useMediaLibrary();
  const t   = useTranslations('admin.gallery');

  /* ── upload state (reuse existing logic) ── */
  const [uploadQueue,   setUploadQueue]   = useState<UploadQueueItem[]>([]);
  const [isUploading,   setIsUploading]   = useState(false);
  const [prepQueue,     setPrepQueue]     = useState<File[]>([]);
  const [isDragging,    setIsDragging]    = useState(false);
  const [uploadConfig,  setUploadConfig]  = useState<UploadConfig>(DEFAULT_UPLOAD_CONFIG);
  const [showAdvanced,  setShowAdvanced]  = useState(false);
  const [activeTab,         setActiveTab]         = useState<'library' | 'seo' | 'analytics' | 'tools'>('library');
  const [mobileFolderOpen, setMobileFolderOpen] = useState(false);

  const fileInputRef   = useRef<HTMLInputElement>(null);
  const sentinelRef    = useRef<HTMLDivElement>(null);

  /* ── infinite scroll ── */
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && lib.hasMore && !lib.loading && !lib.loadingMore) {
        lib.loadMore();
      }
    }, { rootMargin: '200px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [lib.hasMore, lib.loading, lib.loadingMore, lib.loadMore]);

  /* ── upload logic (mirrors GalleryManager) ── */
  const runImageUpload = useCallback(async (f: File, seo: PreparingSeoMeta, cfg: UploadConfig) => {
    const fd = new FormData();
    fd.append('file', f);
    fd.append('folder', lib.folder === 'all' ? 'general' : lib.folder);
    fd.append('quality', String(cfg.quality));
    if (seo.alt)     fd.append('alt',     seo.alt);
    if (seo.title)   fd.append('title',   seo.title);
    if (seo.caption) fd.append('caption', seo.caption);
    const queueIdx = uploadQueue.findIndex((q) => q.name === f.name && !q.done && !q.error);
    try {
      const res = await fetch('/api/media/upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Failed');
      setUploadQueue((q) => q.map((item, i) => i === queueIdx ? { ...item, done: true } : item));
    } catch {
      setUploadQueue((q) => q.map((item, i) => i === queueIdx ? { ...item, error: 'Failed' } : item));
    }
  }, [lib.folder, uploadQueue]);

  const runVideoUpload = useCallback(async (f: File) => {
    const fd = new FormData();
    fd.append('file', f);
    fd.append('folder', lib.folder === 'all' ? 'general' : lib.folder);
    const queueIdx = uploadQueue.findIndex((q) => q.name === f.name && !q.done && !q.error);
    try {
      const res = await fetch('/api/media/upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Failed');
      setUploadQueue((q) => q.map((item, i) => i === queueIdx ? { ...item, done: true } : item));
    } catch {
      setUploadQueue((q) => q.map((item, i) => i === queueIdx ? { ...item, error: 'Failed' } : item));
    }
  }, [lib.folder, uploadQueue]);

  const uploadFiles = useCallback((files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    setIsUploading(true);
    setUploadQueue((prev) => [...prev, ...list.map((f) => ({ name: f.name, done: false }))]);
    const images: File[] = [], videos: File[] = [];
    for (const f of list) (f.type.startsWith('video/') ? videos : images).push(f);
    if (images.length) setPrepQueue((q) => [...q, ...images]);
    for (const v of videos) void runVideoUpload(v);
  }, [runVideoUpload]);

  const confirmPrep = useCallback(async (seo: PreparingSeoMeta, cfg: UploadConfig) => {
    const file = prepQueue[0];
    if (!file) return;
    setPrepQueue((q) => q.slice(1));
    await runImageUpload(file, seo, cfg);
  }, [prepQueue, runImageUpload]);

  const cancelPrep = useCallback(() => {
    const file = prepQueue[0];
    if (!file) return;
    setPrepQueue((q) => q.slice(1));
    setUploadQueue((q) => {
      const idx = q.findIndex((r) => r.name === file.name && !r.done && !r.error);
      if (idx === -1) return q;
      const next = q.slice(); next.splice(idx, 1); return next;
    });
  }, [prepQueue]);

  useEffect(() => {
    if (!uploadQueue.length) { setIsUploading(false); return; }
    const allDone = uploadQueue.every((q) => q.done || q.error);
    if (allDone && prepQueue.length === 0) {
      setIsUploading(false);
      const timer = setTimeout(() => setUploadQueue([]), 3000);
      lib.refresh();
      return () => clearTimeout(timer);
    }
  }, [uploadQueue, prepQueue]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── replace handler ── */
  const handleReplace = async (id: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`/api/media/${id}/replace`, { method: 'POST', body: fd });
    if (res.ok) lib.refresh();
  };

  /* ── SEO filter shortcut ── */
  const applyFilterString = (filterStr: string) => {
    const params = new URLSearchParams(filterStr);
    const patch: Parameters<typeof lib.changeAdv>[0] = {};
    if (params.get('noAlt')     === '1') patch.noAlt     = true;
    if (params.get('noWebP')    === '1') patch.noWebP    = true;
    if (params.get('noAvif')    === '1') patch.noAvif    = true;
    if (params.get('unused')    === '1') patch.unused    = true;
    if (params.get('duplicates')=== '1') patch.duplicates= true;
    if (params.get('minSize'))           patch.minSize   = parseInt(params.get('minSize')!, 10);
    if (params.get('maxScore'))          patch.maxScore  = parseInt(params.get('maxScore')!, 10);
    lib.changeAdv(patch);
    setActiveTab('library');
  };

  /* ── folder list adapter ── */
  const folderList: FolderInfo[] = lib.allFolders.length > 0
    ? lib.allFolders
    : lib.folders.map((f) => ({ name: f.folder, count: f.count, label: null, custom: false }));

  /* ── render ── */
  return (
    <div className="flex h-full min-h-[80vh] overflow-hidden rounded-2xl border border-slate-200 bg-[#F8FAFC] shadow-sm">
      {/* Folder sidebar */}
      <FolderSidebar
        folder={lib.folder}
        folderList={folderList}
        total={lib.total}
        showMobile={mobileFolderOpen}
        onCloseMobile={() => setMobileFolderOpen(false)}
        onChangeFolder={(f) => { lib.changeFolder(f); setMobileFolderOpen(false); }}
        onCreateFolder={lib.createFolder}
        onDeleteFolder={lib.deleteFolder}
        onRenameFolder={lib.renameFolder}
      />

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">

        {/* Top bar */}
        <div className="border-b border-slate-200 bg-white">
          {/* Row 1: title + actions */}
          <div className="flex items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3">
            {/* Mobile folder button */}
            <button type="button" onClick={() => setMobileFolderOpen(true)}
              title="Folders"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 lg:hidden">
              <Ic d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" className="h-4 w-4" />
            </button>
            <div className="flex flex-1 items-center gap-2 min-w-0">
              <h1 className="text-sm font-bold text-[#0F172A] sm:text-base">{t('title')}</h1>
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">{lib.total}</span>
            </div>
            <UploadSettings value={uploadConfig} onChange={setUploadConfig} />
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading}
              className="flex items-center gap-1.5 rounded-xl bg-orange-500 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 active:scale-95 disabled:opacity-60 sm:px-4">
              <Ic d="M4 16v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1M12 12V4m0 0-3 3m3-3 3 3" className="h-4 w-4" />
              <span className="hidden sm:inline">{t('uploadBtn')}</span>
            </button>
            <input ref={fileInputRef} type="file" multiple className="hidden"
              accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm,video/quicktime"
              onChange={(e: ChangeEvent<HTMLInputElement>) => { if (e.target.files) uploadFiles(e.target.files); e.target.value = ''; }} />
          </div>
          {/* Row 2: tabs (scrollable on mobile) */}
          <div className="overflow-x-auto px-3 pb-2 sm:px-4" style={{ scrollbarWidth: 'none' }}>
            <div className="flex w-max rounded-xl border border-slate-200 bg-white p-0.5">
              {(['library', 'seo', 'analytics', 'tools'] as const).map((tab) => (
                <button key={tab} type="button" onClick={() => setActiveTab(tab)}
                  className={`whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium transition sm:px-3
                    ${activeTab === tab ? 'bg-[#0F172A] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                  {tab === 'library' ? '📁 Library'
                    : tab === 'seo' ? 'SEO'
                    : tab === 'analytics' ? '📊'
                    : '🛠 Tools'}
                  {tab === 'seo' && lib.seoHealth?.lowScore ? (
                    <span className="ms-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                      {lib.seoHealth.lowScore}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Analytics tab */}
        {activeTab === 'analytics' && (
          <div className="flex-1 overflow-y-auto p-3 sm:p-6">
            <MediaAnalyticsDashboard />
          </div>
        )}

        {/* Tools tab */}
        {activeTab === 'tools' && (
          <div className="flex-1 overflow-y-auto">
            <MediaToolsPanel />
          </div>
        )}

        {/* SEO Health tab */}
        {activeTab === 'seo' && (
          <div className="flex-1 overflow-y-auto">
            {lib.seoHealth ? (
              <SeoHealthDashboard
                stats={lib.seoHealth}
                folder={lib.folder}
                onFilter={applyFilterString}
                onRefresh={lib.refresh}
              />
            ) : (
              <div className="flex items-center justify-center py-24">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-orange-500" />
              </div>
            )}
          </div>
        )}

        {/* Library tab */}
        {activeTab === 'library' && (
          <>
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 sm:px-4 sm:py-2.5">
              {/* Search */}
              <div className="relative flex-1 min-w-[120px]">
                <span className="pointer-events-none absolute inset-y-0 start-2.5 flex items-center text-slate-400">
                  <Ic d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" className="h-3.5 w-3.5" />
                </span>
                <input type="text" value={lib.q} onChange={(e) => lib.changeQ(e.target.value)}
                  placeholder={t('searchPlaceholder')}
                  className="w-full rounded-xl border border-slate-200 bg-white py-1.5 ps-7 pe-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
              </div>

              {/* Sort */}
              <select value={`${lib.sort}-${lib.dir}`}
                onChange={(e) => {
                  const [s, d] = e.target.value.split('-') as [typeof lib.sort, typeof lib.dir];
                  lib.changeSort(s, d);
                }}
                className="rounded-xl border border-slate-200 bg-white py-1.5 ps-2.5 pe-7 text-sm text-slate-700 outline-none focus:border-orange-400">
                <option value="createdAt-desc">Newest first</option>
                <option value="createdAt-asc">Oldest first</option>
                <option value="originalName-asc">Name A-Z</option>
                <option value="size-desc">Largest first</option>
                <option value="optimizationScore-asc">Lowest score</option>
                <option value="optimizationScore-desc">Highest score</option>
              </select>

              {/* View toggle */}
              <div className="flex rounded-xl border border-slate-200 bg-white p-0.5">
                {(['grid', 'list'] as const).map((v) => (
                  <button key={v} type="button" onClick={() => lib.setView(v)}
                    className={`rounded-lg p-1.5 transition ${lib.view === v ? 'bg-[#0F172A] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                    <Ic d={v === 'grid' ? 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z' : 'M4 6h16M4 10h16M4 14h16M4 18h16'} className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>

              {/* Advanced filters */}
              <div className="relative">
                <button type="button" onClick={() => setShowAdvanced((v) => !v)}
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium transition
                    ${lib.advIsActive ? 'border-orange-300 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                  <Ic d="M3 6h18M7 12h10M11 18h2" className="h-3.5 w-3.5" />
                  Filters
                  {lib.advIsActive && <span className="rounded-full bg-orange-500 w-1.5 h-1.5" />}
                </button>
                {showAdvanced && (
                  <AdvancedFilters
                    filters={lib.adv}
                    mimeFilter={lib.mimeFilter}
                    isActive={lib.advIsActive}
                    onChange={lib.changeAdv}
                    onMimeChange={lib.changeMime}
                    onClear={lib.clearAdv}
                    onClose={() => setShowAdvanced(false)}
                  />
                )}
              </div>

              {/* Bulk mode */}
              <button type="button"
                onClick={() => { lib.setBulkMode((v) => !v); if (lib.bulkMode) lib.clearSelection(); }}
                className={`rounded-xl border px-3 py-1.5 text-sm font-medium transition
                  ${lib.bulkMode ? 'border-orange-300 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                {t('selectMode')}
              </button>
            </div>

            {/* Upload progress */}
            <UploadProgress queue={uploadQueue} />

            {/* SEO prep modal */}
            {prepQueue[0] && (
              <MediaPreparingPanel
                key={`${prepQueue[0].name}-${prepQueue[0].lastModified}`}
                file={prepQueue[0]}
                context="general"
                queuePosition={prepQueue.length > 1 ? { index: 1, total: prepQueue.length } : undefined}
                onUpload={confirmPrep}
                onCancel={cancelPrep}
              />
            )}

            {/* Bulk actions bar */}
            {lib.bulkMode && (
              <BulkActionsBar
                selectedCount={lib.selectedIds.size}
                totalVisible={lib.assets.length}
                folders={lib.folders}
                onSelectAll={lib.selectAll}
                onClear={lib.clearSelection}
                onDelete={() => {
                  if (!confirm(t('deleteBulkConfirm', { n: lib.selectedIds.size }))) return;
                  void lib.bulkAction('delete');
                }}
                onMove={(f) => void lib.bulkAction('move', { folder: f })}
                onTag={(tags) => void lib.bulkAction('tag', { tags })}
                onOptimize={() => void lib.bulkAction('optimize')}
                onRegenerate={() => void lib.bulkAction('regenerate')}
              />
            )}

            {/* Drop zone + grid */}
            <div className="relative flex-1 overflow-y-auto"
              onDragOver={(e: DragEvent) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e: DragEvent) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files) uploadFiles(e.dataTransfer.files); }}>

              {/* Drag overlay */}
              {isDragging && (
                <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-orange-500/10 backdrop-blur-sm">
                  <div className="rounded-3xl border-2 border-dashed border-orange-500 bg-white/90 px-16 py-12 text-center shadow-2xl">
                    <Ic d="M4 16v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1M12 12V4m0 0-3 3m3-3 3 3" className="mx-auto mb-4 h-12 w-12 text-orange-500" />
                    <p className="text-xl font-bold text-orange-700">{t('uploadDrop')}</p>
                  </div>
                </div>
              )}

              {/* Loading skeleton */}
              {lib.loading && lib.assets.length === 0 && (
                <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                  {Array.from({ length: 18 }).map((_, i) => (
                    <div key={i} className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
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
              {!lib.loading && lib.assets.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-5 py-32 text-center">
                  <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-slate-100">
                    <Ic d="M4 16l4-4 4 4 4-8 4 8M3 3h18v14H3z" className="h-10 w-10 text-slate-300" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-slate-800">
                      {lib.q || lib.advIsActive ? t('emptySearchTitle') : t('emptyTitle')}
                    </p>
                    <p className="mt-1.5 max-w-xs text-sm text-slate-500">
                      {lib.q || lib.advIsActive ? t('emptySearchSubtitle') : t('emptySubtitle')}
                    </p>
                  </div>
                  {lib.advIsActive && (
                    <button type="button" onClick={lib.clearAdv}
                      className="rounded-xl border border-slate-200 px-5 py-2 text-sm text-slate-600 hover:bg-slate-50">
                      Clear filters
                    </button>
                  )}
                </div>
              )}

              {/* Grid */}
              {!lib.loading && lib.assets.length > 0 && lib.view === 'grid' && (
                <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                  {lib.assets.map((asset) => (
                    <LibraryCard
                      key={asset.id}
                      asset={asset}
                      selected={lib.selectedIds.has(asset.id)}
                      active={lib.activeAsset?.id === asset.id}
                      bulkMode={lib.bulkMode}
                      copied={lib.copied}
                      onSelect={() => lib.toggleSelect(asset.id)}
                      onOpen={() => { lib.setActiveAsset(asset); if (lib.bulkMode) lib.setBulkMode(false); }}
                      onCopy={() => lib.copyUrl(asset.url)}
                      onDelete={() => { if (confirm(t('deleteConfirm'))) void lib.deleteOne(asset.id); }}
                    />
                  ))}
                </div>
              )}

              {/* List */}
              {!lib.loading && lib.assets.length > 0 && lib.view === 'list' && (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 border-b border-slate-200 bg-white z-10">
                    <tr>
                      {lib.bulkMode && <th className="w-8 py-3 ps-4" />}
                      <th className="py-3 ps-4 text-start text-xs font-semibold uppercase tracking-wider text-slate-500">File</th>
                      <th className="hidden py-3 px-4 text-start text-xs font-semibold uppercase tracking-wider text-slate-500 sm:table-cell">Folder</th>
                      <th className="hidden py-3 px-4 text-start text-xs font-semibold uppercase tracking-wider text-slate-500 md:table-cell">Size</th>
                      <th className="hidden py-3 px-4 text-start text-xs font-semibold uppercase tracking-wider text-slate-500 lg:table-cell">Score</th>
                      <th className="py-3 pe-4 text-end text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lib.assets.map((asset) => (
                      <tr key={asset.id} onClick={() => lib.setActiveAsset(asset)}
                        className={`cursor-pointer transition hover:bg-slate-50 ${lib.selectedIds.has(asset.id) ? 'bg-orange-50' : lib.activeAsset?.id === asset.id ? 'bg-orange-50/60' : ''}`}>
                        {lib.bulkMode && (
                          <td className="ps-4 py-2.5">
                            <input type="checkbox" checked={lib.selectedIds.has(asset.id)}
                              onChange={(e) => { e.stopPropagation(); lib.toggleSelect(asset.id); }}
                              className="rounded border-slate-300 text-orange-500" />
                          </td>
                        )}
                        <td className="py-2.5 ps-4">
                          <div className="flex items-center gap-3">
                            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                              {!asset.mimeType.startsWith('video/') ? (
                                <SmartImage src={asset.thumbnailUrl || asset.url} alt=""
                                  thumbnailUrl={asset.thumbnailUrl || undefined}
                                  sizes="40px"
                                  className="absolute inset-0 h-full w-full object-cover" />
                              ) : (
                                <Ic d="M5 3l14 9-14 9V3z" className="absolute inset-0 m-auto h-4 w-4 text-slate-400" />
                              )}
                            </div>
                            <span className="truncate max-w-[180px] text-xs text-slate-700">{asset.originalName}</span>
                          </div>
                        </td>
                        <td className="hidden px-4 py-2.5 text-xs text-slate-500 sm:table-cell capitalize">{asset.folder}</td>
                        <td className="hidden px-4 py-2.5 text-xs text-slate-500 md:table-cell">{fmtSize(asset.size)}</td>
                        <td className="hidden px-4 py-2.5 lg:table-cell">
                          {asset.optimizationScore != null && (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold
                              ${asset.optimizationScore >= 80 ? 'bg-emerald-100 text-emerald-700'
                              : asset.optimizationScore >= 60 ? 'bg-amber-100 text-amber-700'
                              : 'bg-red-100 text-red-700'}`}>
                              {asset.optimizationScore}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 pe-4 text-end">
                          <button type="button" onClick={(e) => { e.stopPropagation(); lib.copyUrl(asset.url); }}
                            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700">
                            <Ic d="M8 17.9H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2M10 8h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z" className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Infinite scroll sentinel */}
              <div ref={sentinelRef} className="h-4" />
              {lib.loadingMore && (
                <div className="flex justify-center py-4">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-orange-500" />
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Detail panel */}
      {lib.activeAsset && (
        <AssetDetailPanel
          asset={toMediaAsset(lib.activeAsset)}
          copied={lib.copied}
          folderOptions={(lib.allFolders.length > 0 ? lib.allFolders.map((f) => f.name) : lib.folders.map((f) => f.folder))}
          onClose={() => lib.setActiveAsset(null)}
          onCopy={() => lib.copyUrl(lib.activeAsset!.url)}
          onDelete={() => {
            if (confirm(t('deleteConfirm'))) void lib.deleteOne(lib.activeAsset!.id);
          }}
          onReplace={(file) => handleReplace(lib.activeAsset!.id, file)}
          onSave={(data) => lib.saveAsset(lib.activeAsset!.id, data).then(() => {})}
        />
      )}
    </div>
  );
}
