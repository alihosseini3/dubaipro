'use client';

import { SmartImage } from '@/components/ui/SmartImage';
import {
  useCallback, useEffect, useRef, useState, type ChangeEvent,
} from 'react';

/* ─── Types ──────────────────────────────────────────────────────────────── */

type Asset = {
  id: string;
  url: string;
  thumbnailUrl?: string | null;
  originalName: string;
  alt: string | null;
  folder: string;
  size: number;
  mimeType: string;
};

type FolderInfo = { name: string; count: number };

export type GalleryPickerProps = {
  mode?: 'single' | 'multi';
  /** Pre-selected folder to open — pass 'cat-{slug}' for product category context */
  initialFolder?: string;
  /** Already-used URLs so they appear pre-checked in multi mode */
  currentUrls?: string[];
  onClose(): void;
  /** Always returns array; single mode returns length-1 array */
  onPick(urls: string[]): void;
};

const PAGE_SIZE = 30;

function fmtSize(b: number) {
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)}KB`;
  return `${(b / 1024 / 1024).toFixed(1)}MB`;
}

const Ic = ({ d, className = 'h-4 w-4' }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d={d} />
  </svg>
);

/* ─── Component ──────────────────────────────────────────────────────────── */

export function GalleryPickerModal({
  mode = 'single',
  initialFolder = 'all',
  currentUrls = [],
  onClose,
  onPick,
}: GalleryPickerProps) {
  const [assets, setAssets]         = useState<Asset[]>([]);
  const [folders, setFolders]       = useState<FolderInfo[]>([]);
  const [folder, setFolder]         = useState(initialFolder);
  const [search, setSearch]         = useState('');
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]           = useState(0);
  const [isLoading, setIsLoading]   = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selected, setSelected]     = useState<Set<string>>(new Set(currentUrls));
  const [upFormat,  setUpFormat]    = useState<'webp'|'jpeg'|'png'|'avif'>('webp');
  const [upQuality, setUpQuality]   = useState<'high'|'medium'|'low'>('medium');
  const fileRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Keyboard close ─────────────────────────────────────────────────── */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  /* ── Fetch folders ───────────────────────────────────────────────────── */

  useEffect(() => {
    fetch('/api/admin/media/folders')
      .then((r) => r.json())
      .then((j) => setFolders(j.data ?? []));
  }, []);

  /* ── Fetch assets ────────────────────────────────────────────────────── */

  const load = useCallback(async (opts?: { folder?: string; search?: string; page?: number }) => {
    setIsLoading(true);
    const f = opts?.folder ?? folder;
    const s = opts?.search ?? search;
    const p = opts?.page   ?? page;
    const params = new URLSearchParams({ folder: f, search: s, sort: 'newest', page: String(p), limit: String(PAGE_SIZE) });
    try {
      const res  = await fetch(`/api/admin/media?${params}`);
      const json = await res.json();
      setAssets(json.data ?? []);
      setTotal(json.total ?? 0);
      setTotalPages(json.totalPages ?? 1);
    } finally {
      setIsLoading(false);
    }
  }, [folder, search, page]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Search debounce ─────────────────────────────────────────────────── */

  const onSearch = (val: string) => {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setPage(1); load({ search: val, page: 1 }); }, 300);
  };

  /* ── Folder change ───────────────────────────────────────────────────── */

  const changeFolder = (f: string) => {
    setFolder(f);
    setPage(1);
    load({ folder: f, page: 1 });
  };

  /* ── Upload ──────────────────────────────────────────────────────────── */

  const upload = async (files: FileList) => {
    setIsUploading(true);
    const targetFolder = folder === 'all' ? 'general' : folder;
    for (const file of Array.from(files)) {
      const isVideo = file.type.startsWith('video/');
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', targetFolder);
      if (!isVideo) { fd.append('format', upFormat); fd.append('quality', upQuality); }
      await fetch('/api/upload', { method: 'POST', body: fd }).catch(() => {});
    }
    setIsUploading(false);
    // Refresh folders list too
    fetch('/api/admin/media/folders').then((r) => r.json()).then((j) => setFolders(j.data ?? []));
    setPage(1);
    load({ page: 1 });
  };

  const onFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) upload(e.target.files);
    e.target.value = '';
  };

  /* ── Selection ───────────────────────────────────────────────────────── */

  const toggleAsset = (url: string) => {
    if (mode === 'single') {
      onPick([url]);
      onClose();
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(url) ? next.delete(url) : next.add(url);
      return next;
    });
  };

  const confirmMulti = () => {
    if (selected.size > 0) onPick([...selected]);
    onClose();
  };

  /* ── Sidebar folder list ─────────────────────────────────────────────── */

  const PRESET = ['general', 'products', 'categories', 'banners', 'blog', 'brands'];
  const catFolders = folders.filter((f) => f.name.startsWith('cat-'));
  const presetFolders = folders.filter((f) => PRESET.includes(f.name));
  const otherFolders = folders.filter((f) => !PRESET.includes(f.name) && !f.name.startsWith('cat-'));

  const folderLabel = (name: string) => {
    if (name.startsWith('cat-')) return name.slice(4).replace(/-/g, ' ');
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  /* ─────────────────────────────────────────────────────────────────────── */

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <aside className="hidden w-44 shrink-0 flex-col border-r border-slate-200 bg-slate-50 lg:flex">
          <div className="border-b border-slate-200 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Media Library</p>
          </div>
          <nav className="flex-1 overflow-y-auto py-1.5 text-sm">
            <FolderBtn name="all" active={folder === 'all'} label="All files" count={total} onClick={() => changeFolder('all')} />
            {presetFolders.length > 0 && (
              <>
                <p className="mt-2 px-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Folders</p>
                {presetFolders.map((f) => (
                  <FolderBtn key={f.name} name={f.name} active={folder === f.name} label={folderLabel(f.name)} count={f.count} onClick={() => changeFolder(f.name)} />
                ))}
              </>
            )}
            {catFolders.length > 0 && (
              <>
                <p className="mt-2 px-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Categories</p>
                {catFolders.map((f) => (
                  <FolderBtn key={f.name} name={f.name} active={folder === f.name} label={folderLabel(f.name)} count={f.count} onClick={() => changeFolder(f.name)} />
                ))}
              </>
            )}
            {otherFolders.map((f) => (
              <FolderBtn key={f.name} name={f.name} active={folder === f.name} label={folderLabel(f.name)} count={f.count} onClick={() => changeFolder(f.name)} />
            ))}
          </nav>
        </aside>

        {/* ── Main ────────────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col">

          {/* Header */}
          <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-900">
                {mode === 'multi' ? 'Select Images' : 'Select Image'}
              </p>
              {folder !== 'all' && (
                <p className="text-[11px] text-slate-500 capitalize">Folder: {folderLabel(folder)}</p>
              )}
            </div>
            {/* Search */}
            <div className="relative w-52">
              <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-slate-400">
                <Ic d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" className="h-3.5 w-3.5" />
              </span>
              <input value={search} onChange={(e) => onSearch(e.target.value)} type="text"
                placeholder="Search…"
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-7 pr-3 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200" />
            </div>
            {/* Mobile folder select */}
            <select value={folder} onChange={(e) => changeFolder(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white py-1.5 pl-2 pr-6 text-sm text-slate-700 outline-none lg:hidden">
              <option value="all">All</option>
              {folders.map((f) => <option key={f.name} value={f.name}>{folderLabel(f.name)}</option>)}
            </select>
            {/* Upload to current folder */}
            <select value={upFormat} onChange={(e) => setUpFormat(e.target.value as 'webp'|'jpeg'|'png'|'avif')}
              className="rounded-lg border border-slate-200 bg-white py-1.5 pl-2 pr-5 text-xs text-slate-700 outline-none">
              <option value="webp">WebP</option>
              <option value="avif">AVIF</option>
              <option value="jpeg">JPEG</option>
              <option value="png">PNG</option>
            </select>
            <select value={upQuality} onChange={(e) => setUpQuality(e.target.value as 'high'|'medium'|'low')}
              className="rounded-lg border border-slate-200 bg-white py-1.5 pl-2 pr-5 text-xs text-slate-700 outline-none">
              <option value="high">High</option>
              <option value="medium">Med</option>
              <option value="low">Low</option>
            </select>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={isUploading}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
              <Ic d="M4 16v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1M12 12V4m0 0-3 3m3-3 3 3" className="h-3.5 w-3.5" />
              {isUploading ? 'Uploading…' : 'Upload'}
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm,video/quicktime" multiple className="hidden" onChange={onFileInput} />
            <button type="button" onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
              <Ic d="M18 6L6 18M6 6l12 12" />
            </button>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading && (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                {Array.from({ length: 15 }).map((_, i) => (
                  <div key={i} className="aspect-square animate-pulse rounded-xl bg-slate-200" />
                ))}
              </div>
            )}

            {!isLoading && assets.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                  <Ic d="M4 16l4-4 4 4 4-8 4 8M3 3h18v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3z" className="h-7 w-7 text-slate-400" />
                </div>
                <p className="font-semibold text-slate-700">No images in this folder</p>
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                  Upload first image
                </button>
              </div>
            )}

            {!isLoading && assets.length > 0 && (
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5">
                {assets.map((asset) => {
                  const isSelected = selected.has(asset.url);
                  return (
                    <button key={asset.id} type="button"
                      onClick={() => toggleAsset(asset.url)}
                      className={`group relative overflow-hidden rounded-xl border-2 transition focus:outline-none ${isSelected ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-transparent hover:border-slate-300'}`}
                    >
                      <div className="relative aspect-square w-full overflow-hidden bg-slate-900">
                        {asset.mimeType.startsWith('video/') ? (
                          <>
                            <video src={asset.url} muted preload="metadata"
                              className="absolute inset-0 h-full w-full object-cover transition duration-150 group-hover:scale-105" />
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
                            sizes="150px"
                            className="absolute inset-0 h-full w-full object-cover transition duration-150 group-hover:scale-105" />
                        )}
                      </div>
                      {/* Selected check */}
                      {isSelected && (
                        <span className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 shadow">
                          <Ic d="M20 6L9 17l-5-5" className="h-3 w-3 text-white" />
                        </span>
                      )}
                      {/* Hover meta */}
                      <div className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 transition-transform duration-150 group-hover:translate-y-0">
                        <p className="truncate text-[10px] text-white/90">{asset.originalName}</p>
                        <p className="text-[10px] text-white/60">{fmtSize(asset.size)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex justify-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button key={p} type="button" onClick={() => { setPage(p); load({ page: p }); }}
                    className={`flex h-7 w-7 items-center justify-center rounded-lg border text-xs font-medium ${page === p ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer (multi mode) */}
          {mode === 'multi' && (
            <div className="flex items-center gap-3 border-t border-slate-200 px-4 py-3">
              <p className="flex-1 text-sm text-slate-600">
                {selected.size > 0 ? <><span className="font-semibold text-indigo-600">{selected.size}</span> image{selected.size > 1 ? 's' : ''} selected</> : 'Click images to select'}
              </p>
              <button type="button" onClick={onClose}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button type="button" onClick={confirmMulti} disabled={selected.size === 0}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40">
                Use {selected.size > 0 ? `${selected.size} image${selected.size > 1 ? 's' : ''}` : 'images'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Sidebar folder button ──────────────────────────────────────────────── */

function FolderBtn({ name, active, label, count, onClick }: {
  name: string; active: boolean; label: string; count: number; onClick(): void;
}) {
  return (
    <button type="button" onClick={onClick}
      className={`flex w-full items-center justify-between px-4 py-1.5 text-sm transition ${active ? 'bg-indigo-50 font-semibold text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
      <span className="truncate capitalize">{label}</span>
      <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500'}`}>{count}</span>
    </button>
  );
}
