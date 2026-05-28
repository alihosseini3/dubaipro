'use client';

import { SmartImage } from '@/components/ui/SmartImage';
import { useTranslations } from 'next-intl';

import { fmtSize, type MediaAsset } from './types';

const Ic = ({ d, className = 'h-4 w-4' }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d={d} />
  </svg>
);

type Props = {
  asset: MediaAsset;
  selected: boolean;
  active: boolean;
  bulkMode: boolean;
  copied: string | null;
  onSelect(): void;
  onOpen(): void;
  onEdit(): void;
  onCopy(): void;
  onDelete(): void;
};

export function MediaCard({
  asset, selected, active, bulkMode, copied,
  onSelect, onOpen, onEdit, onCopy, onDelete,
}: Props) {
  const t = useTranslations('admin.gallery');
  const isVideo = asset.mimeType.startsWith('video/');
  const ext = asset.mimeType.split('/')[1]?.toUpperCase().slice(0, 4) ?? 'IMG';
  const score = asset.optimizationScore;

  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-2xl border-2 bg-white shadow-sm transition-all duration-200 cursor-pointer
        ${active    ? 'border-orange-500 shadow-lg shadow-orange-500/20 ring-2 ring-orange-200'
        : selected  ? 'border-orange-400 shadow-md shadow-orange-400/10'
        : 'border-slate-100 hover:border-slate-300 hover:shadow-md'}`}
    >
      {/* ── Checkbox ─────────────────────────────────── */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
        className={`absolute left-2 top-2 z-20 flex h-5 w-5 items-center justify-center rounded-md border-2 shadow-sm transition-all duration-150
          ${selected || bulkMode ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
          ${selected ? 'border-orange-500 bg-orange-500' : 'border-white/90 bg-white/80 hover:border-orange-400'}`}
        aria-label={t('select')}
      >
        {selected && <Ic d="M20 6L9 17l-5-5" className="h-3 w-3 text-white" />}
      </button>

      {/* ── Type badge ────────────────────────────────── */}
      <span className={`absolute right-2 top-2 z-10 rounded-lg px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide backdrop-blur-sm
        ${isVideo ? 'bg-violet-600/80 text-white' : 'bg-slate-900/65 text-white/90'}`}>
        {isVideo ? 'VID' : ext}
      </span>

      {/* ── SEO score badge ───────────────────────────── */}
      {score !== null && score !== undefined && score < 70 && (
        <span className="absolute right-2 top-9 z-10 rounded-lg bg-amber-500/90 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm">
          {score}
        </span>
      )}

      {/* ── Thumbnail ─────────────────────────────────── */}
      <div
        role="button"
        tabIndex={0}
        onClick={bulkMode ? onSelect : onOpen}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (bulkMode ? onSelect() : onOpen())}
        className="relative block aspect-square w-full cursor-pointer overflow-hidden bg-slate-900"
      >
        {isVideo ? (
          <>
            <video src={asset.url} muted preload="metadata"
              className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105" />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition group-hover:scale-110 group-hover:bg-black/70">
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

        {/* Hover action overlay - uses real buttons so must be inside a div, not a button */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <div className="flex items-center gap-1">
            <OverlayBtn
              title={copied === asset.url ? t('copied') : t('copyUrl')}
              onClick={(e) => { e.stopPropagation(); onCopy(); }}
            >
              {copied === asset.url
                ? <Ic d="M20 6L9 17l-5-5" className="h-4 w-4 text-emerald-400" />
                : <Ic d="M8 17.9H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2M10 8h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z" className="h-4 w-4" />}
            </OverlayBtn>
            <OverlayBtn
              title={t('editDetails')}
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
            >
              <Ic d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" className="h-4 w-4" />
            </OverlayBtn>
            <OverlayBtn
              title={t('delete')}
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              danger
            >
              <Ic d="M3 6h18M8 6V4h8v2M19 6v14H5V6" className="h-4 w-4" />
            </OverlayBtn>
          </div>
        </div>
      </div>

      {/* ── Info footer ───────────────────────────────── */}
      <div className="flex items-start gap-1 px-2.5 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium leading-tight text-slate-800">
            {asset.originalName}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-400">
            {asset.width && asset.height ? `${asset.width}×${asset.height} · ` : ''}
            {fmtSize(asset.size)}
          </p>
        </div>
      </div>
    </div>
  );
}

function OverlayBtn({
  children, onClick, title, danger,
}: {
  children: React.ReactNode;
  onClick(e: React.MouseEvent): void;
  title?: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex h-8 w-8 items-center justify-center rounded-xl backdrop-blur-sm transition
        ${danger
          ? 'bg-red-500/80 text-white hover:bg-red-600'
          : 'bg-white/20 text-white hover:bg-white/30'}`}
    >
      {children}
    </button>
  );
}
