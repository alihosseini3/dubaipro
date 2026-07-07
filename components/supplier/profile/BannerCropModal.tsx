'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  file: File;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}

const BANNER_ASPECT = 3; // 3:1 ratio
const OUTPUT_W = 1200;
const OUTPUT_H = 400;

export function BannerCropModal({ file, onConfirm, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [imgSrc, setImgSrc] = useState<string>('');
  const [imgNaturalW, setImgNaturalW] = useState(0);
  const [imgNaturalH, setImgNaturalH] = useState(0);
  const [containerW, setContainerW] = useState(640);

  // offsetY: how many pixels from the top of the natural image the crop starts
  const [offsetY, setOffsetY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartOffset = useRef(0);

  // Load the file as an image
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgSrc(url);
    const img = new Image();
    img.onload = () => {
      setImgNaturalW(img.naturalWidth);
      setImgNaturalH(img.naturalHeight);
      imgRef.current = img;
      // Centre the initial crop window vertically
      const cropH = img.naturalWidth / BANNER_ASPECT;
      setOffsetY(Math.max(0, (img.naturalHeight - cropH) / 2));
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Observe container width for responsive preview
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 640;
      setContainerW(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Derived values
  const cropNatH = imgNaturalW > 0 ? imgNaturalW / BANNER_ASPECT : 0;
  const maxOffsetY = Math.max(0, imgNaturalH - cropNatH);

  // Preview canvas: scale natural crop to containerW × containerW/BANNER_ASPECT
  const previewH = containerW / BANNER_ASPECT;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || imgNaturalW === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = containerW;
    canvas.height = previewH;
    ctx.drawImage(
      img,
      0, offsetY, imgNaturalW, cropNatH,   // source rect
      0, 0, containerW, previewH            // dest rect
    );
  }, [containerW, previewH, offsetY, imgNaturalW, cropNatH]);

  useEffect(() => { draw(); }, [draw]);

  // Drag handlers — vertical only
  const onMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    dragStartY.current = e.clientY;
    dragStartOffset.current = offsetY;
    e.preventDefault();
  };
  const onTouchStart = (e: React.TouchEvent) => {
    setDragging(true);
    dragStartY.current = e.touches[0].clientY;
    dragStartOffset.current = offsetY;
  };

  useEffect(() => {
    if (!dragging) return;
    const scaleY = imgNaturalH / previewH;
    const onMove = (e: MouseEvent | TouchEvent) => {
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      const deltaY = (dragStartY.current - clientY) * scaleY;
      setOffsetY(Math.min(maxOffsetY, Math.max(0, dragStartOffset.current + deltaY)));
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [dragging, imgNaturalH, previewH, maxOffsetY]);

  // Export at OUTPUT_W × OUTPUT_H
  const handleConfirm = () => {
    const img = imgRef.current;
    if (!img) return;
    const out = document.createElement('canvas');
    out.width = OUTPUT_W;
    out.height = OUTPUT_H;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, offsetY, imgNaturalW, cropNatH, 0, 0, OUTPUT_W, OUTPUT_H);
    out.toBlob((blob) => { if (blob) onConfirm(blob); }, 'image/jpeg', 0.92);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900">Adjust banner position</h2>
            <p className="mt-0.5 text-xs text-slate-500">Drag up or down to reposition</p>
          </div>
          <button
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Cancel"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4">
          <div
            ref={containerRef}
            className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
            style={{ cursor: dragging ? 'grabbing' : 'grab', aspectRatio: `${BANNER_ASPECT}` }}
            onMouseDown={onMouseDown}
            onTouchStart={onTouchStart}
          >
            <canvas
              ref={canvasRef}
              className="pointer-events-none w-full"
              style={{ display: 'block' }}
            />
            {!imgSrc && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
                Loading image…
              </div>
            )}
            {maxOffsetY > 0 && (
              <div className="absolute bottom-2 right-2 rounded-full bg-black/40 px-2 py-1 text-[10px] text-white">
                Drag to reposition
              </div>
            )}
          </div>

          {maxOffsetY === 0 && imgNaturalW > 0 && (
            <p className="mt-2 text-center text-xs text-slate-400">
              Image fits exactly — no repositioning needed.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 px-5 py-4">
          <button
            onClick={onCancel}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="rounded-xl bg-orange-500 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
            disabled={!imgSrc}
          >
            Use this crop
          </button>
        </div>
      </div>
    </div>
  );
}
