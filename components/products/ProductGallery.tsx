'use client';

import { useMemo, useState } from 'react';

import { ProductImage } from './ProductImage';

type ProductGalleryProps = {
  title: string;
  imageUrl?: string | null;
  images?: string[] | null;
};

/**
 * Interactive product gallery: large main image + thumbnails strip.
 *
 * - Shows the primary `imageUrl` first, then any additional `images`.
 * - Clicking a thumbnail swaps the main image with a fade-in transition.
 * - When no images exist, falls back to a single gradient placeholder
 *   (via `ProductImage`) so layouts stay intact.
 *
 * Future-ready: accept any length `images` array from the API / CDN without
 * further changes.
 */
export function ProductGallery({ title, imageUrl, images }: ProductGalleryProps) {
  const sources = useMemo(() => {
    const extras = Array.isArray(images) ? images.filter(Boolean) : [];
    const combined = imageUrl ? [imageUrl, ...extras] : extras;
    // De-duplicate while preserving order.
    return Array.from(new Set(combined));
  }, [imageUrl, images]);

  const [activeIndex, setActiveIndex] = useState(0);
  const active = sources[activeIndex];

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* keying on the active URL replays the fade-in animation on swap */}
        <ProductImage
          key={active ?? 'placeholder'}
          title={title}
          src={active ?? null}
          aspect="aspect-square"
          priority
        />
      </div>

      {sources.length > 1 && (
        <div className="grid grid-cols-4 gap-2">
          {sources.map((src, i) => {
            const isActive = i === activeIndex;
            return (
              <button
                key={src}
                type="button"
                onClick={() => setActiveIndex(i)}
                aria-label={`${title} — ${i + 1}`}
                aria-current={isActive}
                className={
                  'group overflow-hidden rounded-xl border bg-white transition-all duration-200 ' +
                  (isActive
                    ? 'border-slate-900 shadow-md ring-2 ring-slate-900/10'
                    : 'border-slate-200 hover:border-slate-400 hover:shadow-sm')
                }
              >
                <ProductImage
                  title={title}
                  src={src}
                  aspect="aspect-square"
                  zoomOnHover
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
