'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

type MediaSrc = { url: string; isVideo: boolean };

type Props = {
  title:    string;
  imageUrl?: string | null;
  /** Additional images and/or videos in display order. */
  images?:  string[] | null;
  /** Optional pre-formatted views label (e.g. "1,234 views"). */
  viewsText?: string;
  /** Optional status pill rendered over the hero. */
  statusBadge?: React.ReactNode;
  /** Floating action buttons rendered at the top-end of the hero (e.g. Watch / Share). */
  actions?: React.ReactNode;
};

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|$)/i;

function toMedia(url: string): MediaSrc {
  return { url, isVideo: VIDEO_EXT.test(url) };
}

/**
 * Premium auction gallery — modeled on `ProductGalleryPro` but with
 * extras tuned for high-value lots:
 *
 *   - Vertical thumbnail rail on desktop, horizontal swipe row on mobile.
 *   - Hero image with mouse-track zoom lens (desktop only).
 *   - Video thumbnails play inline; videos render with native controls.
 *   - Click hero (or press Enter) to open a fullscreen lightbox with
 *     keyboard navigation. ESC closes.
 *   - Touch swipe gesture flips between media on phones.
 */
export function AuctionGallery({
  title,
  imageUrl,
  images,
  viewsText,
  statusBadge,
  actions,
}: Props) {
  const t = useTranslations('auctions.detail');
  const sources: MediaSrc[] = useMemo(() => {
    const list = [
      ...(imageUrl ? [imageUrl] : []),
      ...(Array.isArray(images) ? images : []),
    ].filter(Boolean);
    const seen = new Set<string>();
    return list
      .filter((u) => (seen.has(u) ? false : (seen.add(u), true)))
      .map(toMedia);
  }, [imageUrl, images]);

  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  const current = sources[active];
  const hasGallery = sources.length > 1;

  /* keyboard nav */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') setActive((i) => Math.min(sources.length - 1, i + 1));
      else if (e.key === 'ArrowLeft') setActive((i) => Math.max(0, i - 1));
      else if (e.key === 'Escape' && lightbox) setLightbox(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sources.length, lightbox]);

  /* body scroll lock for lightbox */
  useEffect(() => {
    if (!lightbox) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [lightbox]);

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!mainRef.current || current?.isVideo) return;
    const rect = mainRef.current.getBoundingClientRect();
    setZoom({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top)  / rect.height) * 100,
    });
  }
  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start == null) return;
    const end = e.changedTouches[0]?.clientX ?? start;
    const delta = end - start;
    if (Math.abs(delta) < 40) return;
    if (delta < 0) setActive((i) => Math.min(sources.length - 1, i + 1));
    else            setActive((i) => Math.max(0, i - 1));
  }

  if (sources.length === 0) {
    return (
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 md:aspect-[4/3]">
        <div className="flex h-full w-full items-center justify-center text-slate-300">
          <svg viewBox="0 0 24 24" className="h-20 w-20" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
            <path d="M4 16l4-4 4 4 4-8 4 8M3 3h18v14H3z" />
          </svg>
        </div>
        {statusBadge}
      </div>
    );
  }

  return (
    <div className={hasGallery ? 'grid grid-cols-1 gap-3 lg:grid-cols-[76px_minmax(0,1fr)]' : ''}>
      {/* Thumbnail rail */}
      {hasGallery && (
        <ol className="order-2 flex gap-2 overflow-x-auto pb-1 lg:order-1 lg:flex-col lg:overflow-visible lg:pb-0" aria-label={title}>
          {sources.map((src, i) => {
            const isActive = i === active;
            return (
              <li key={src.url} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  aria-label={`${title} — ${i + 1}`}
                  aria-current={isActive}
                  className={`group relative block h-[68px] w-[68px] overflow-hidden rounded-xl border bg-white transition-all duration-300 ${
                    isActive
                      ? 'border-[#F97316] shadow-[0_0_22px_rgba(249,115,22,0.28)] ring-2 ring-orange-500/30'
                      : 'border-slate-200 hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md'
                  }`}
                >
                  {src.isVideo ? (
                    <>
                      <video src={src.url} muted preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white">
                          <PlayIcon className="h-3.5 w-3.5 translate-x-0.5" />
                        </span>
                      </span>
                    </>
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={src.url} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {/* Hero */}
      <div className="order-1 lg:order-2">
        <div className={`grid gap-3 ${actions ? 'xl:grid-cols-[minmax(0,1fr)_92px]' : ''}`}>
        <div
          ref={mainRef}
          onMouseMove={onMouseMove}
          onMouseLeave={() => setZoom(null)}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onClick={() => !current?.isVideo && setLightbox(true)}
          className="group/hero relative aspect-square w-full select-none overflow-hidden rounded-2xl border border-slate-200 bg-[radial-gradient(circle_at_50%_35%,#ffffff_0%,#f8fafc_42%,#eef2f7_100%)] shadow-[0_16px_40px_rgba(15,23,42,0.08)] ring-1 ring-white md:aspect-[4/3]"
        >
          {current?.isVideo ? (
            <video
              key={current.url}
              src={current.url}
              controls
              playsInline
              preload="metadata"
              className="absolute inset-0 h-full w-full object-contain"
            />
          ) : current ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={current.url}
                src={current.url}
                alt={title}
                className="h-full w-full cursor-zoom-in object-contain p-4 transition duration-500 group-hover/hero:scale-[1.015] sm:p-5"
              />
              {zoom && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 hidden lg:block"
                  style={{
                    backgroundImage: `url(${current.url})`,
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '220%',
                    backgroundPosition: `${zoom.x}% ${zoom.y}%`,
                  }}
                />
              )}
            </>
          ) : null}

          {/* Overlays */}
          {statusBadge && <div className="absolute start-3 top-3">{statusBadge}</div>}

          {/* Image counter */}
          {sources.length > 1 && (
            <span className="pointer-events-none absolute start-3 bottom-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold text-white tabular-nums shadow-md backdrop-blur-sm">
              <ImageIcon className="h-3 w-3" />
              {t('imageCount', { current: active + 1, total: sources.length })}
            </span>
          )}

          {viewsText && !actions && (
            <span className="absolute end-3 top-3 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
              <EyeIcon className="h-3 w-3" />
              {viewsText}
            </span>
          )}

          {current?.isVideo && (
            <span className="absolute start-3 top-3 inline-flex items-center gap-1 rounded-full bg-rose-500/90 px-2.5 py-1 text-[11px] font-black text-white shadow-lg">
              <PlayIcon className="h-3 w-3" />
              VIDEO
            </span>
          )}

          {current && !current.isVideo && (
            <span className="pointer-events-none absolute end-3 top-3 hidden rounded-full bg-slate-950/65 px-3 py-1 text-[11px] font-bold text-white opacity-0 shadow-lg backdrop-blur transition group-hover/hero:opacity-100 lg:inline-flex">
              {t('clickToZoom')}
            </span>
          )}

          {/* Mobile dot pager */}
          {hasGallery && (
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 lg:hidden">
              <div className="flex gap-1.5 rounded-full bg-black/40 px-2 py-1 backdrop-blur">
                {sources.map((_, i) => (
                  <span key={i} className={`h-1.5 w-1.5 rounded-full transition ${i === active ? 'bg-white' : 'bg-white/50'}`} />
                ))}
              </div>
            </div>
          )}
        </div>
        {actions && (
          <div
            className="grid grid-cols-2 gap-2 xl:flex xl:flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {actions}
          </div>
        )}
        </div>
      </div>

      {/* Fullscreen lightbox */}
      {lightbox && current && !current.isVideo && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(false)}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/95 p-4 backdrop-blur-xl"
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setLightbox(false); }}
            className="absolute end-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Close"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
          {hasGallery && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setActive((i) => Math.max(0, i - 1)); }}
                className="absolute start-4 top-1/2 -translate-y-1/2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                aria-label="Previous"
              >
                <ArrowIcon className="h-5 w-5 rotate-180" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setActive((i) => Math.min(sources.length - 1, i + 1)); }}
                className="absolute end-4 top-1/2 -translate-y-1/2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                aria-label="Next"
              >
                <ArrowIcon className="h-5 w-5" />
              </button>
            </>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current.url} alt={title} onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[90vw] animate-[auction-lightbox_220ms_ease-out] rounded-2xl object-contain shadow-2xl" />
          {/* Fullscreen counter */}
          {hasGallery && (
            <span className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white tabular-nums backdrop-blur">
              {t('imageCount', { current: active + 1, total: sources.length })}
            </span>
          )}
          <style>{`
            @keyframes auction-lightbox {
              0% { opacity: 0; transform: scale(0.96); }
              100% { opacity: 1; transform: scale(1); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}

/* ─── Icons ───────────────────────────────────────────────────────────── */

function PlayIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden><path d="M5 3l14 9-14 9V3z" /></svg>;
}
function EyeIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>;
}
function CloseIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 6 6 18M6 6l12 12" /></svg>;
}
function ArrowIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 18 6-6-6-6" /></svg>;
}
function ImageIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>;
}
function ZoomIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3M11 8v6M8 11h6" /></svg>;
}
