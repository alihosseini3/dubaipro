'use client';

import { SmartImage } from '@/components/ui/SmartImage';
import { type ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import { fmtSize, folderLabel, type FolderInfo } from './types';

/* ─── types ──────────────────────────────────────────────────────────────── */

type Asset = {
  id: string; url: string; originalName: string; alt: string | null;
  mimeType: string; size: number; width: number | null; height: number | null;
  thumbnailUrl?: string | null;
};

export type MediaPickerMode = 'single' | 'multi';

export type MediaPickerProps = {
  mode?: MediaPickerMode;
  onPick(urls: string[]): void;
  onClose(): void;
};

/* ─── helpers ────────────────────────────────────────────────────────────── */

const Ic = ({ d, className = 'h-4 w-4' }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d={d} />
  </svg>
);

const PAGE = 24;

/* ─── component ──────────────────────────────────────────────────────────── */

export function MediaPickerModal({ mode = 'single', onPick, onClose }: MediaPickerProps) {
  const t = useTranslations('admin.gallery');
  const [folder, setFolder]     = useState('all');
  const [folders, setFolders]   = useState<FolderInfo[]>([]);
  const [assets, setAssets]     = useState<Asset[]>([]);
  const [total, setTotal]       = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [upFormat, setUpFormat] = useState<'webp'|'jpeg'|'png'|'avif'>('webp');
  const [upQuality, setUpQuality] = useState<'high'|'medium'|'low'>('medium');
  const fileRef  = useRef<HTMLInputElement>(null);
  const timer    = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch('/api/admin/media/folders')
      .then((r) => r.json())
      .then((j) => setFolders(j.data ?? []));
  }, []);

  const load = useCallback(async (opts?: { folder?: string; search?: string; page?: number }) => {
    setLoading(true);
    const f = opts?.folder ?? folder;
    const s = opts?.search ?? search;
    const p = opts?.page   ?? page;
    /* Unified on /api/media (same endpoint the main gallery uses). */
    const params = new URLSearchParams({ sort: 'createdAt', dir: 'desc', page: String(p), limit: String(PAGE) });
    if (f && f !== 'all') params.set('folder', f);
    if (s.trim())         params.set('q', s.trim());
    try {
      const res  = await fetch(`/api/media?${params}`);
      const json = await res.json();
      setAssets(json.data ?? []);
      setTotal(json.total ?? 0);
      setTotalPages(json.totalPages ?? 1);
    } finally { setLoading(false); }
  }, [folder, search, page]);

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const changeFolder = (f: string) => { setFolder(f); setPage(1); void load({ folder: f, page: 1 }); };
  const changePage   = (p: number) => { setPage(p); void load({ page: p }); };

  const onSearch = (val: string) => {
    setSearch(val);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { setPage(1); void load({ search: val, page: 1 }); }, 300);
  };

  const upload = async (files: FileList) => {
    setUploading(true);
    const targetFolder = folder === 'all' ? 'general' : folder;
    for (const file of Array.from(files)) {
      const isVideo = file.type.startsWith('video/');
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', targetFolder);
      if (!isVideo) { fd.append('format', upFormat); fd.append('quality', upQuality); }
      await fetch('/api/media/upload', { method: 'POST', body: fd }).catch(() => {});
    }
    setUploading(false);
    fetch('/api/admin/media/folders').then((r) => r.json()).then((j) => setFolders(j.data ?? []));
    setPage(1);
    void load({ page: 1 });
  };

  const toggle = (url: string) => {
    if (mode === 'single') { onPick([url]); onClose(); return; }
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(url) ? next.delete(url) : next.add(url);
      return next;
    });
  };

  /* close on Escape */
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const PRESET = ['general', 'products', 'categories', 'banners', 'blog', 'brands'];
  const presetFolders = PRESET.map((n) => folders.find((f) => f.name === n)).filter(Boolean) as FolderInfo[];
  const catFolders    = folders.filter((f) => f.name.startsWith('cat-'));
  const otherFolders  = folders.filter((f) => !PRESET.includes(f.name) && !f.name.startsWith('cat-'));

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Sidebar ────────────────────────────────────────────────── */}
        <aside className="hidden w-48 shrink-0 flex-col border-e border-slate-200 bg-[#0F172A] lg:flex">
          <div className="border-b border-slate-700 px-4 py-3.5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
              {t('foldersTitle')}
            </p>
          </div>
          <nav className="flex-1 overflow-y-auto py-1.5">
            <SideBtn name="all" label={t('folderAll')} count={total} active={folder === 'all'} onClick={() => changeFolder('all')} />
            {presetFolders.length > 0 && (
              <>
                <p className="mt-3 px-4 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-600">{t('foldersPreset')}</p>
                {presetFolders.map((f) => (
                  <SideBtn key={f.name} name={f.name} label={folderLabel(f.name, f.label)} count={f.count} active={folder === f.name} onClick={() => changeFolder(f.name)} />
                ))}
              </>
            )}
            {catFolders.length > 0 && (
              <>
                <p className="mt-3 px-4 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-600">{t('foldersCategories')}</p>
                {catFolders.map((f) => (
                  <SideBtn key={f.name} name={f.name} label={folderLabel(f.name, f.label)} count={f.count} active={folder === f.name} onClick={() => changeFolder(f.name)} />
                ))}
              </>
            )}
            {otherFolders.map((f) => (
              <SideBtn key={f.name} name={f.name} label={folderLabel(f.name, f.label)} count={f.count} active={folder === f.name} onClick={() => changeFolder(f.name)} />
            ))}
          </nav>
        </aside>

        {/* ── Main ────────────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900">
                {mode === 'multi' ? t('pickerTitleMulti') : t('pickerTitle')}
              </p>
              {folder !== 'all' && (
                <p className="text-[11px] text-slate-500 capitalize">{folderLabel(folder)}</p>
              )}
            </div>

            {/* Search */}
            <div className="relative w-48">
              <span className="pointer-events-none absolute inset-y-0 start-2.5 flex items-center text-slate-400">
                <Ic d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" className="h-3.5 w-3.5" />
              </span>
              <input value={search} onChange={(e) => onSearch(e.target.value)} type="text"
                placeholder={t('searchPlaceholder')}
                className="w-full rounded-xl border border-slate-200 bg-white py-1.5 ps-7 pe-3 text-sm text-slate-700 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
            </div>

            {/* Mobile folder */}
            <select value={folder} onChange={(e) => changeFolder(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white py-1.5 ps-2.5 pe-6 text-sm text-slate-700 outline-none lg:hidden">
              <option value="all">{t('folderAll')}</option>
              {folders.map((f) => <option key={f.name} value={f.name}>{folderLabel(f.name, f.label)}</option>)}
            </select>

            {/* Format / quality */}
            <select value={upFormat} onChange={(e) => setUpFormat(e.target.value as typeof upFormat)}
              className="rounded-xl border border-slate-200 bg-white py-1.5 ps-2 pe-5 text-xs text-slate-700 outline-none">
              <option value="webp">WebP</option><option value="avif">AVIF</option>
              <option value="jpeg">JPEG</option><option value="png">PNG</option>
            </select>
            <select value={upQuality} onChange={(e) => setUpQuality(e.target.value as typeof upQuality)}
              className="rounded-xl border border-slate-200 bg-white py-1.5 ps-2 pe-5 text-xs text-slate-700 outline-none">
              <option value="high">Hi</option><option value="medium">Med</option><option value="low">Lo</option>
            </select>

            {/* Upload */}
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
              className="flex items-center gap-1.5 rounded-xl bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50">
              <Ic d="M4 16v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1M12 12V4m0 0-3 3m3-3 3 3" className="h-3.5 w-3.5" />
              {uploading ? '…' : t('pickerUpload')}
            </button>
            <input ref={fileRef} type="file"
              accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm"
              multiple className="hidden"
              onChange={(e: ChangeEvent<HTMLInputElement>) => { if (e.target.files?.length) void upload(e.target.files); e.target.value = ''; }} />

            {/* Close */}
            <button type="button" onClick={onClose}
              className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
              <Ic d="M18 6L6 18M6 6l12 12" />
            </button>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading && (
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                {Array.from({ length: PAGE }).map((_, i) => (
                  <div key={i} className="aspect-square animate-pulse rounded-2xl bg-slate-200" />
                ))}
              </div>
            )}

            {!loading && assets.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                  <Ic d="M4 16l4-4 4 4 4-8 4 8M3 3h18v14H3z" className="h-7 w-7 text-slate-300" />
                </div>
                <p className="font-semibold text-slate-700">{search ? t('emptySearchTitle') : t('emptyTitle')}</p>
                {!search && (
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600">
                    {t('emptyButton')}
                  </button>
                )}
              </div>
            )}

            {!loading && assets.length > 0 && (
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                {assets.map((asset) => {
                  const isSel = selected.has(asset.url);
                  const isVideo = asset.mimeType.startsWith('video/');
                  return (
                    <button key={asset.id} type="button" onClick={() => toggle(asset.url)}
                      className={`group relative overflow-hidden rounded-2xl border-2 transition focus:outline-none ${
                        isSel ? 'border-orange-500 shadow-lg shadow-orange-500/20 ring-2 ring-orange-200' : 'border-transparent hover:border-slate-300 hover:shadow-md'
                      }`}
                    >
                      <div className="relative aspect-square w-full overflow-hidden bg-slate-900">
                        {isVideo ? (
                          <>
                            <video src={asset.url} muted preload="metadata"
                              className="absolute inset-0 h-full w-full object-cover transition duration-200 group-hover:scale-105" />
                            <span className="absolute inset-0 flex items-center justify-center">
                              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white">
                                <Ic d="M5 3l14 9-14 9V3z" className="h-3.5 w-3.5 translate-x-0.5" />
                              </span>
                            </span>
                          </>
                        ) : (
                          <SmartImage src={asset.thumbnailUrl || asset.url}
                            alt={asset.alt || asset.originalName}
                            thumbnailUrl={asset.thumbnailUrl || undefined}
                            sizes="120px"
                            className="absolute inset-0 h-full w-full object-cover transition duration-200 group-hover:scale-105" />
                        )}
                        {/* Hover meta */}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <p className="truncate text-[10px] text-white/90">{asset.originalName}</p>
                          <p className="text-[10px] text-white/60">{fmtSize(asset.size)}</p>
                        </div>
                      </div>
                      {/* Check badge */}
                      {isSel && (
                        <span className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 shadow">
                          <Ic d="M20 6L9 17l-5-5" className="h-3 w-3 text-white" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex justify-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button key={p} type="button" onClick={() => changePage(p)}
                    className={`flex h-7 w-7 items-center justify-center rounded-xl border text-xs font-medium transition ${
                      page === p ? 'border-[#0F172A] bg-[#0F172A] text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}>
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer (multi) */}
          {mode === 'multi' && (
            <div className="flex items-center gap-3 border-t border-slate-200 px-4 py-3">
              <p className="flex-1 text-sm text-slate-600">
                {selected.size > 0
                  ? <><span className="font-semibold text-orange-600">{selected.size}</span>{' '}{t('pickerSelected', { n: selected.size })}</>
                  : t('pickerClickToSelect')}
              </p>
              <button type="button" onClick={onClose}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                {t('pickerCancel')}
              </button>
              <button type="button" onClick={() => { if (selected.size > 0) onPick([...selected]); onClose(); }} disabled={selected.size === 0}
                className="rounded-xl bg-orange-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-40">
                {t('pickerConfirm', { n: selected.size })}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SideBtn({ name, label, count, active, onClick }: {
  name: string; label: string; count: number; active: boolean; onClick(): void;
}) {
  return (
    <button type="button" onClick={onClick}
      className={`flex w-full items-center justify-between px-4 py-1.5 text-sm transition ${
        active ? 'bg-orange-500/15 font-semibold text-orange-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
      }`}>
      <span className="truncate">{label}</span>
      <span className={`ms-1 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-orange-500/20 text-orange-300' : 'bg-slate-700 text-slate-500'}`}>{count}</span>
    </button>
  );
}

