'use client';

/**
 * MediaPickerDialog — full gallery picker returning complete UploadedAsset objects.
 *
 * Differences from legacy GalleryPickerModal:
 *  - Returns UploadedAsset[] (full pipeline result) instead of string[] URLs
 *  - Reads from /api/media (new service endpoint with full pagination/search)
 *  - Folder sidebar with counts
 *  - Infinite-scroll pagination (load-more button)
 *  - Search debounce
 *  - Inline upload via SmartMediaUploader so the picker itself never shows raw <input>
 *  - RTL support via logical CSS
 *  - Keyboard: Escape = close, Enter = confirm selection
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { UploadedAsset } from './SmartMediaUploader';

/* ─────────────────────────────────────────────────────────────────────────── */
/* Types                                                                        */
/* ─────────────────────────────────────────────────────────────────────────── */

type GalleryAsset = {
  id:           string;
  url:          string;
  thumbnailUrl: string | null;
  originalName: string;
  alt:          string | null;
  folder:       string;
  size:         number;
  mimeType:     string;
  width:        number | null;
  height:       number | null;
  optimizationScore: number | null;
  blurDataURL:  string | null;
  dominantColor: string | null;
  variants:     Array<{ preset: string; format: string; url: string; width: number; height: number; size: number }>;
};

type FolderInfo = { folder: string; count: number };

export interface MediaPickerDialogProps {
  mode?:           'single' | 'multi';
  initialFolder?:  string;
  /** Already-selected asset IDs (shown pre-checked in multi mode). */
  selectedIds?:    string[];
  onClose():       void;
  /** Always returns array; single mode = length-1. */
  onPick(assets: UploadedAsset[]): void;
}

const PAGE_SIZE = 30;

function toUploadedAsset(a: GalleryAsset): UploadedAsset {
  const masterVariant = a.variants.find((v) => v.preset === 'original' && v.format === 'webp')
                     ?? a.variants.find((v) => v.preset === 'original')
                     ?? a.variants[0];
  return {
    id:               a.id,
    url:              a.url,
    thumbnailUrl:     a.thumbnailUrl,
    width:            masterVariant?.width ?? a.width ?? 0,
    height:           masterVariant?.height ?? a.height ?? 0,
    size:             masterVariant?.size ?? a.size,
    originalSize:     a.size,
    compressionRatio: 0,
    optimizationScore: a.optimizationScore ?? 0,
    hash:             '',
    duplicate:        false,
    variants:         a.variants as UploadedAsset['variants'],
    blurDataURL:      a.blurDataURL,
    dominantColor:    a.dominantColor,
    mimeType:         a.mimeType,
  };
}

function fmtSize(b: number) {
  if (b < 1024)         return `${b}B`;
  if (b < 1024 * 1024)  return `${(b / 1024).toFixed(0)}KB`;
  return `${(b / 1024 / 1024).toFixed(1)}MB`;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Component                                                                    */
/* ─────────────────────────────────────────────────────────────────────────── */

export function MediaPickerDialog({
  mode = 'single',
  initialFolder = 'all',
  selectedIds = [],
  onClose,
  onPick,
}: MediaPickerDialogProps) {
  const [assets,     setAssets]     = useState<GalleryAsset[]>([]);
  const [folders,    setFolders]    = useState<FolderInfo[]>([]);
  const [folder,     setFolder]     = useState(initialFolder);
  const [search,     setSearch]     = useState('');
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading,    setLoading]    = useState(false);
  const [selected,   setSelected]   = useState<Set<string>>(new Set(selectedIds));
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Keyboard ─────────────────────────────────────────────────────────── */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); }
      if (e.key === 'Enter' && selected.size > 0) handleConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Fetch folders ─────────────────────────────────────────────────────── */

  useEffect(() => {
    fetch('/api/media?includeFolders=1&limit=1')
      .then((r) => r.ok ? r.json() : null)
      .then((j) => { if (j?.folders) setFolders(j.folders); })
      .catch(() => {});
  }, []);

  /* ── Fetch assets ──────────────────────────────────────────────────────── */

  const fetchAssets = useCallback((f: string, s: string, p: number, append: boolean) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE) });
    if (f !== 'all') params.set('folder', f);
    if (s.trim())   params.set('q', s.trim());
    fetch(`/api/media?${params}`)
      .then((r) => r.ok ? r.json() : null)
      .then((j) => {
        if (!j) return;
        setAssets((prev) => append ? [...prev, ...(j.data ?? [])] : (j.data ?? []));
        setTotalPages(j.totalPages ?? 1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setPage(1);
    fetchAssets(folder, search, 1, false);
  }, [folder, fetchAssets]); // search applied via debounce below

  const onSearchChange = (val: string) => {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      fetchAssets(folder, val, 1, false);
    }, 350);
  };

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchAssets(folder, search, next, true);
  };

  /* ── Selection ──────────────────────────────────────────────────────────── */

  const toggle = (id: string) => {
    if (mode === 'single') {
      setSelected(new Set([id]));
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }
  };

  const handleConfirm = () => {
    const picked = assets
      .filter((a) => selected.has(a.id))
      .map(toUploadedAsset);
    onPick(picked);
  };

  /* ── Render ─────────────────────────────────────────────────────────────── */

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Media Picker"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
          <GalleryIcon />
          <h2 className="flex-1 text-sm font-semibold text-slate-800">
            Choose from Gallery
            {selected.size > 0 && (
              <span className="ms-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                {selected.size} selected
              </span>
            )}
          </h2>
          {/* Search */}
          <div className="relative hidden sm:block">
            <SearchIcon className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search images…"
              className="h-8 w-52 rounded-lg border border-slate-200 bg-slate-50 ps-8 pe-3 text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
            />
          </div>
          <button type="button" onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close">
            <XIcon />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <aside className="hidden w-44 flex-shrink-0 overflow-y-auto border-e border-slate-100 bg-slate-50/50 p-2 sm:flex sm:flex-col">
            <FolderItem
              label="All media"
              count={folders.reduce((s, f) => s + f.count, 0)}
              active={folder === 'all'}
              onClick={() => setFolder('all')}
            />
            {folders.map((f) => (
              <FolderItem
                key={f.folder}
                label={f.folder}
                count={f.count}
                active={folder === f.folder}
                onClick={() => setFolder(f.folder)}
              />
            ))}
          </aside>

          {/* Grid */}
          <main className="flex flex-1 flex-col overflow-y-auto p-3">
            {/* Mobile search */}
            <div className="mb-3 sm:hidden">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Search images…"
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white ps-8 pe-3 text-xs outline-none focus:border-indigo-400"
                />
              </div>
            </div>

            {loading && assets.length === 0 && (
              <div className="flex flex-1 items-center justify-center">
                <Spinner />
              </div>
            )}

            {!loading && assets.length === 0 && (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-slate-400">
                <EmptyIcon />
                <p className="text-sm">No images found</p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
              {assets.map((asset) => {
                const isSelected = selected.has(asset.id);
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => toggle(asset.id)}
                    className={`group relative overflow-hidden rounded-xl border-2 transition ${
                      isSelected
                        ? 'border-indigo-500 ring-2 ring-indigo-300'
                        : 'border-transparent hover:border-slate-300'
                    }`}
                    title={asset.alt ?? asset.originalName}
                  >
                    <div
                      className="aspect-square w-full overflow-hidden bg-slate-100"
                      style={{ backgroundColor: asset.dominantColor ?? undefined }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={asset.thumbnailUrl ?? asset.url}
                        alt={asset.alt ?? ''}
                        loading="lazy"
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    </div>
                    {isSelected && (
                      <span className="absolute end-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white shadow">
                        <CheckIcon />
                      </span>
                    )}
                    {asset.optimizationScore !== null && (
                      <span className={`absolute start-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white shadow ${
                        asset.optimizationScore >= 80 ? 'bg-emerald-500/90'
                        : asset.optimizationScore >= 60 ? 'bg-amber-500/90'
                        : 'bg-red-500/90'
                      }`}>
                        {asset.optimizationScore}
                      </span>
                    )}
                    <div className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-black/70 to-transparent p-1.5 transition group-hover:translate-y-0">
                      <p className="truncate text-[10px] font-medium text-white">
                        {asset.originalName}
                      </p>
                      <p className="text-[9px] text-white/70">
                        {asset.width && asset.height ? `${asset.width}×${asset.height} · ` : ''}{fmtSize(asset.size)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {page < totalPages && !loading && (
              <button type="button" onClick={loadMore}
                className="mx-auto mt-4 rounded-xl border border-slate-300 bg-white px-6 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-900">
                Load more
              </button>
            )}
            {loading && assets.length > 0 && (
              <div className="mt-4 flex justify-center"><Spinner /></div>
            )}
          </main>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs text-slate-500">
            {selected.size === 0
              ? mode === 'single' ? 'Click an image to select' : 'Click images to select'
              : `${selected.size} image${selected.size > 1 ? 's' : ''} selected`}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-900">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={selected.size === 0}
              className="rounded-lg bg-indigo-600 px-5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {mode === 'single' ? 'Use Image' : `Use ${selected.size} Image${selected.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Sub-components                                                               */
/* ─────────────────────────────────────────────────────────────────────────── */

function FolderItem({
  label, count, active, onClick,
}: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
        active
          ? 'bg-indigo-100 font-semibold text-indigo-700'
          : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      <span className="truncate">{label}</span>
      <span className={`text-[10px] tabular-nums ${active ? 'text-indigo-500' : 'text-slate-400'}`}>{count}</span>
    </button>
  );
}

/* ─── Icons ─────────────────────────────────────────────────────────────── */

function GalleryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
      strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-slate-500" aria-hidden>
      <path d="M4 16l4-4 4 4 4-8 4 8M3 3h18v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3z" />
    </svg>
  );
}
function SearchIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}
      strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" aria-hidden>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
function EmptyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
      strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 3v18" />
    </svg>
  );
}
function Spinner() {
  return (
    <svg className="h-6 w-6 animate-spin text-slate-400" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity={0.2} strokeWidth={3} />
      <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
    </svg>
  );
}
