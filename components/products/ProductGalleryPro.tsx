'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { ProductImage } from './ProductImage';

type Props = {
  title: string;
  imageUrl?: string | null;
  images?: string[] | null;
};

/**
 * Premium gallery used by the storefront PDP.
 *
 * Behaviour:
 *   - Large main image fills the left column (`aspect-square` so the
 *     layout never jumps on slow image loads).
 *   - Desktop: hovering the main image pans a zoomed crop that
 *     follows the cursor — the same UX shoppers expect from Amazon /
 *     ASOS PDPs.
 *   - Touch: horizontal swipe between images (no library; tracks
 *     pointerdown / pointerup + a small threshold so vertical scroll
 *     still wins when the gesture is mostly vertical).
 *   - Thumbnail rail sits on the right at `lg+` and below the main
 *     image on smaller viewports. Active thumb gets a thicker ring.
 *   - Arrow keys ←/→ navigate when the gallery is focused, for
 *     keyboard users.
 *
 * The component is purely visual; the parent page already handles
 * meta tags / preload hints for the priority image.
 */
export function ProductGalleryPro({ title, imageUrl, images }: Props) {
  const sources = useMemo(() => {
    const extras = Array.isArray(images) ? images.filter(Boolean) : [];
    const combined = imageUrl ? [imageUrl, ...extras] : extras;
    return Array.from(new Set(combined));
  }, [imageUrl, images]);

  const [active, setActive] = useState(0);
  const current = sources[active];

  // Zoom state: percent coordinates of the mouse over the main image.
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!mainRef.current) return;
    const rect = mainRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoom({ x, y });
  }

  // Touch swipe — works on phones where hover-zoom isn't available.
  const touchStartX = useRef<number | null>(null);
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
    else setActive((i) => Math.max(0, i - 1));
  }

  // Keyboard nav.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (document.activeElement?.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight') {
        setActive((i) => Math.min(sources.length - 1, i + 1));
      } else if (e.key === 'ArrowLeft') {
        setActive((i) => Math.max(0, i - 1));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sources.length]);

  // When there's only a single image we collapse the layout to a
  // single column — otherwise the empty 88px thumbnail rail leaves an
  // ugly gutter on desktop.
  const hasGallery = sources.length > 1;

  return (
    <div
      className={
        hasGallery
          ? 'grid grid-cols-1 gap-4 lg:grid-cols-[88px_1fr]'
          : 'grid grid-cols-1 gap-4'
      }
    >
      {/* Thumbnail rail — vertical on desktop, horizontal on mobile. */}
      {hasGallery && (
        <ol
          className="order-2 flex gap-2 overflow-x-auto pb-1 lg:order-1 lg:flex-col lg:overflow-visible lg:pb-0"
          aria-label="Product images"
        >
          {sources.map((src, i) => {
            const isActive = i === active;
            return (
              <li key={src} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  onMouseEnter={() => setActive(i)}
                  aria-label={`${title} — ${i + 1}`}
                  aria-current={isActive}
                  className={`group block h-20 w-20 overflow-hidden rounded-xl border bg-white transition-all duration-200 ${
                    isActive
                      ? 'border-orange-500 shadow-md ring-2 ring-orange-500/20'
                      : 'border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <ProductImage
                    title={title}
                    src={src}
                    aspect="aspect-square"
                  />
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {/* Main image with hover zoom. */}
      <div className="order-1 lg:order-2">
        <div
          ref={mainRef}
          onMouseMove={onMouseMove}
          onMouseLeave={() => setZoom(null)}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          className="relative aspect-square w-full select-none overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <ProductImage
            key={current ?? 'placeholder'}
            title={title}
            src={current ?? null}
            aspect="aspect-square"
            priority
          />

          {/* Desktop-only zoom lens overlay (pointer:fine) */}
          {current && zoom && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 hidden lg:block"
              style={{
                backgroundImage: `url(${current})`,
                backgroundRepeat: 'no-repeat',
                backgroundSize: '220%',
                backgroundPosition: `${zoom.x}% ${zoom.y}%`,
                opacity: 1,
                transition: 'opacity 120ms'
              }}
            />
          )}

          {/* Mobile dot pager */}
          {hasGallery && (
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 gap-1.5 lg:hidden">
              <div className="flex gap-1.5 rounded-full bg-black/30 px-2 py-1 backdrop-blur">
                {sources.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 w-1.5 rounded-full transition ${
                      i === active ? 'bg-white' : 'bg-white/50'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
