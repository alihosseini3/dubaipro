'use client';

import dynamic from 'next/dynamic';
import { useRef, useState } from 'react';

const MediaPickerModal = dynamic(
  () =>
    import('@/components/admin/media/MediaPickerModal').then((m) => ({
      default: function MP(p: import('@/components/admin/media/MediaPickerModal').MediaPickerProps) {
        const C = m.MediaPickerModal;
        return <C {...p} />;
      }
    })),
  { ssr: false }
);

type Props = {
  label:        string;
  hint?:        string;
  addLabel:     string;
  removeLabel:  string;
  value:        string[];
  onChange:     (next: string[]) => void;
  max?:         number;
};

/**
 * Multi-image gallery picker.
 *
 *   - Uses the existing `MediaPickerModal` in `multi` mode so admins
 *     can either upload new media or pick from the library — same UX
 *     as the page builder.
 *   - Drag-and-drop to reorder. First image is the featured image.
 *   - Hover the tile to reveal the remove button (touch: always shown).
 *
 * Emits `string[]` URLs in display order; the auction service stores
 * them as `AuctionImage` rows with `order = index`.
 */
export function GalleryPicker({
  label,
  hint,
  addLabel,
  removeLabel,
  value,
  onChange,
  max = 12,
}: Props) {
  const [open, setOpen] = useState(false);
  const dragId = useRef<number | null>(null);
  const [overId, setOverId] = useState<number | null>(null);

  function add(urls: string[]) {
    /* Dedupe while preserving order: keep first occurrence. */
    const seen = new Set(value);
    const merged = [...value];
    for (const u of urls) {
      if (!seen.has(u) && merged.length < max) {
        merged.push(u);
        seen.add(u);
      }
    }
    onChange(merged);
  }

  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  function move(fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0) return;
    const next = value.slice();
    const [removed] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, removed);
    onChange(next);
  }

  return (
    <div>
      <div className="mb-2 flex items-end justify-between gap-2">
        <div>
          <label className="block text-xs font-semibold text-slate-700">{label}</label>
          {hint && <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>}
        </div>
        <span className="text-[11px] font-medium text-slate-500">{value.length}/{max}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {value.map((url, i) => (
          <div
            key={`${url}-${i}`}
            draggable
            onDragStart={() => { dragId.current = i; }}
            onDragOver={(e) => { e.preventDefault(); if (dragId.current !== null && dragId.current !== i) setOverId(i); }}
            onDragLeave={() => setOverId(null)}
            onDrop={(e) => {
              e.preventDefault();
              const from = dragId.current;
              setOverId(null);
              dragId.current = null;
              if (from === null) return;
              move(from, i);
            }}
            className={`group relative aspect-square overflow-hidden rounded-xl border-2 bg-slate-100 transition ${
              overId === i ? 'border-[#F97316] ring-2 ring-orange-200' : 'border-slate-200'
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" draggable={false} />
            {i === 0 && (
              <span className="absolute start-1 top-1 rounded-md bg-[#F97316] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow">
                Featured
              </span>
            )}
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label={removeLabel}
              className="absolute end-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white opacity-0 transition hover:bg-rose-600 group-hover:opacity-100 focus:opacity-100"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
            <span className="absolute bottom-1 start-1 rounded-md bg-black/50 px-1.5 py-0.5 text-[9px] font-bold text-white">
              {i + 1}
            </span>
          </div>
        ))}

        {value.length < max && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-500 transition hover:border-[#F97316] hover:bg-orange-50/40 hover:text-[#F97316]"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span className="px-2 text-center text-[11px] font-medium leading-tight">{addLabel}</span>
          </button>
        )}
      </div>

      {open && (
        <MediaPickerModal
          mode="multi"
          onPick={(urls) => { add(urls); setOpen(false); }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
