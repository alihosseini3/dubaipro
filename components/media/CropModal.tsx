'use client';

/**
 * CropModal — canvas-based image crop dialog. Zero external dependencies.
 *
 * Features:
 *  - Free-form or locked aspect-ratio crop handles
 *  - Zoom via slider or mouse-wheel
 *  - Drag to pan the image
 *  - Reset, apply buttons
 *  - Returns a Blob (PNG or JPEG) ready for the upload queue
 *  - Keyboard accessible: Enter = apply, Escape = cancel
 *  - RTL-safe (uses logical CSS)
 *  - Mobile-friendly (touch drag)
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';

/* ─────────────────────────────────────────────────────────────────────────── */
/* Types                                                                        */
/* ─────────────────────────────────────────────────────────────────────────── */

export interface CropResult {
  blob:   Blob;
  width:  number;
  height: number;
}

export interface CropModalProps {
  /** Object URL of the original image. */
  src:           string;
  /** Optional locked ratio (e.g. 16/9, 1, 4/3). Undefined = free crop. */
  aspectRatio?:  number;
  /** Output MIME. Default: 'image/webp' */
  outputMime?:   string;
  /** Output quality 0-1. Default: 0.92 */
  outputQuality?: number;
  onApply:  (result: CropResult) => void;
  onCancel: () => void;
}

interface Box { x: number; y: number; w: number; h: number }

/* ─────────────────────────────────────────────────────────────────────────── */
/* Constants                                                                    */
/* ─────────────────────────────────────────────────────────────────────────── */

const HANDLE_SIZE = 10;
const MIN_BOX     = 30;

type Handle = 'nw'|'n'|'ne'|'e'|'se'|'s'|'sw'|'w'|'move'|null;

/* ─────────────────────────────────────────────────────────────────────────── */
/* Component                                                                    */
/* ─────────────────────────────────────────────────────────────────────────── */

export function CropModal({
  src,
  aspectRatio,
  outputMime    = 'image/webp',
  outputQuality = 0.92,
  onApply,
  onCancel,
}: CropModalProps) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const imgRef        = useRef<HTMLImageElement | null>(null);

  const [zoom, setZoom]     = useState(1);
  const [pan,  setPan]      = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [box,  setBox]      = useState<Box>({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
  const [ready, setReady]   = useState(false);

  const activeHandle = useRef<Handle>(null);
  const dragStart    = useRef<{ px: number; py: number; box: Box; pan: { x: number; y: number } } | null>(null);

  /* ── Load image ──────────────────────────────────────────────────────── */

  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      setReady(true);
      if (aspectRatio) {
        setBox(centerBox(aspectRatio));
      }
    };
    img.src = src;
  }, [src, aspectRatio]);

  /* ── Draw canvas ─────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!ready || !canvasRef.current || !imgRef.current) return;
    draw(canvasRef.current, imgRef.current, zoom, pan, box);
  }, [ready, zoom, pan, box]);

  /* ── Keyboard ────────────────────────────────────────────────────────── */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
      if (e.key === 'Enter')  { e.preventDefault(); handleApply(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // re-bind when handleApply changes

  /* ── Pointer drag ────────────────────────────────────────────────────── */

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect   = canvas.getBoundingClientRect();
    const px     = (e.clientX - rect.left) / rect.width;
    const py     = (e.clientY - rect.top)  / rect.height;

    const h = hitHandle(box, px, py);
    activeHandle.current = h ?? 'move';
    dragStart.current    = { px, py, box: { ...box }, pan: { ...pan } };
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  }, [box, pan]);

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!dragStart.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect   = canvas.getBoundingClientRect();
    const px     = (e.clientX - rect.left) / rect.width;
    const py     = (e.clientY - rect.top)  / rect.height;
    const dx     = px - dragStart.current.px;
    const dy     = py - dragStart.current.py;

    if (activeHandle.current === 'move') {
      setPan({
        x: dragStart.current.pan.x + dx * canvas.width  / zoom,
        y: dragStart.current.pan.y + dy * canvas.height / zoom,
      });
    } else {
      setBox(resizeBox(dragStart.current.box, activeHandle.current!, dx, dy, aspectRatio));
    }
  }, [zoom, aspectRatio]);

  const onPointerUp = useCallback(() => {
    activeHandle.current = null;
    dragStart.current    = null;
  }, []);

  /* ── Wheel zoom ──────────────────────────────────────────────────────── */

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.5, Math.min(4, z - e.deltaY * 0.001)));
  }, []);

  /* ── Apply ───────────────────────────────────────────────────────────── */

  const handleApply = useCallback(() => {
    if (!imgRef.current || !canvasRef.current) return;
    const img    = imgRef.current;
    const canvas = canvasRef.current;
    const offscreen = document.createElement('canvas');
    const cw     = canvas.width;
    const ch     = canvas.height;

    // Crop region in image coordinates
    const ix = (box.x * cw - (cw / 2) + pan.x * zoom + (cw / 2)) / zoom;
    const iy = (box.y * ch - (ch / 2) + pan.y * zoom + (ch / 2)) / zoom;
    const iw = (box.w * cw) / zoom;
    const ih = (box.h * ch) / zoom;

    // Scale to actual image pixels
    const sx = (ix / cw) * img.naturalWidth;
    const sy = (iy / ch) * img.naturalHeight;
    const sw = (iw / cw) * img.naturalWidth;
    const sh = (ih / ch) * img.naturalHeight;

    offscreen.width  = Math.round(sw);
    offscreen.height = Math.round(sh);
    const ctx = offscreen.getContext('2d')!;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, offscreen.width, offscreen.height);

    offscreen.toBlob(
      (blob) => {
        if (!blob) return;
        onApply({ blob, width: offscreen.width, height: offscreen.height });
      },
      outputMime,
      outputQuality,
    );
  }, [box, pan, zoom, outputMime, outputQuality, onApply]);

  /* ── Reset ───────────────────────────────────────────────────────────── */

  const reset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setBox(aspectRatio ? centerBox(aspectRatio) : { x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
  }, [aspectRatio]);

  /* ── Render ──────────────────────────────────────────────────────────── */

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Crop image"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="flex w-full max-w-2xl flex-col gap-3 rounded-2xl bg-white p-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-800">Crop Image</p>
          {aspectRatio && (
            <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700">
              {aspectRatio === 1 ? '1:1' : aspectRatio > 1 ? `${aspectRatio.toFixed(2)}:1` : `1:${(1 / aspectRatio).toFixed(2)}`}
            </span>
          )}
          <button type="button" onClick={onCancel}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close">
            <XIcon />
          </button>
        </div>

        {/* Canvas */}
        <div ref={containerRef} className="relative overflow-hidden rounded-xl bg-slate-900">
          {!ready && (
            <div className="flex h-64 items-center justify-center text-slate-400">
              <Spinner />
            </div>
          )}
          <canvas
            ref={canvasRef}
            width={640}
            height={400}
            className={`w-full touch-none ${ready ? 'block' : 'hidden'}`}
            style={{ cursor: activeHandle.current === 'move' ? 'grabbing' : 'crosshair' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onWheel={onWheel}
          />
        </div>

        {/* Zoom slider */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold text-slate-500">Zoom</span>
          <input
            type="range" min={0.5} max={4} step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-indigo-600"
          />
          <span className="w-10 text-right text-xs font-bold tabular-nums text-slate-700">
            {Math.round(zoom * 100)}%
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <button type="button" onClick={reset}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-400">
            Reset
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel}
              className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-900">
              Cancel
            </button>
            <button type="button" onClick={handleApply}
              className="rounded-lg bg-indigo-600 px-5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700">
              Apply Crop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Canvas draw                                                                  */
/* ─────────────────────────────────────────────────────────────────────────── */

function draw(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  zoom: number,
  pan: { x: number; y: number },
  box: Box,
) {
  const ctx = canvas.getContext('2d')!;
  const cw  = canvas.width;
  const ch  = canvas.height;

  ctx.clearRect(0, 0, cw, ch);

  // Draw image centered + panned + zoomed
  const iw     = img.naturalWidth  * zoom * (cw / img.naturalWidth);
  const ih     = img.naturalHeight * zoom * (ch / img.naturalHeight);
  const ox     = (cw - iw) / 2 + pan.x * zoom;
  const oy     = (ch - ih) / 2 + pan.y * zoom;

  // Simplified: draw image filling canvas, apply zoom as scale
  ctx.save();
  ctx.translate(cw / 2, ch / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-cw / 2 + pan.x, -ch / 2 + pan.y);
  ctx.drawImage(img, 0, 0, cw, ch);
  ctx.restore();

  // Darkened overlay outside crop box
  const bx = box.x * cw;
  const by = box.y * ch;
  const bw = box.w * cw;
  const bh = box.h * ch;

  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, cw, by);
  ctx.fillRect(0, by, bx, bh);
  ctx.fillRect(bx + bw, by, cw - bx - bw, bh);
  ctx.fillRect(0, by + bh, cw, ch - by - bh);

  // Crop border
  ctx.strokeStyle = '#fff';
  ctx.lineWidth   = 1.5;
  ctx.strokeRect(bx, by, bw, bh);

  // Rule of thirds
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth   = 0.5;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(bx + (bw / 3) * i, by); ctx.lineTo(bx + (bw / 3) * i, by + bh); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx, by + (bh / 3) * i); ctx.lineTo(bx + bw, by + (bh / 3) * i); ctx.stroke();
  }

  // Corner handles
  ctx.fillStyle = '#fff';
  const handles = getHandlePositions(box, cw, ch);
  for (const [, hx, hy] of handles) {
    ctx.fillRect(hx - HANDLE_SIZE / 2, hy - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
  }
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Geometry helpers                                                             */
/* ─────────────────────────────────────────────────────────────────────────── */

function getHandlePositions(box: Box, cw: number, ch: number): Array<[Handle, number, number]> {
  const { x, y, w, h } = box;
  const bx = x * cw; const by = y * ch; const bw = w * cw; const bh = h * ch;
  return [
    ['nw', bx,        by       ],
    ['n',  bx + bw/2, by       ],
    ['ne', bx + bw,   by       ],
    ['e',  bx + bw,   by + bh/2],
    ['se', bx + bw,   by + bh  ],
    ['s',  bx + bw/2, by + bh  ],
    ['sw', bx,        by + bh  ],
    ['w',  bx,        by + bh/2],
  ];
}

function hitHandle(box: Box, px: number, py: number): Handle | null {
  const HIT = HANDLE_SIZE / 100; // normalized
  for (const [name, hx, hy] of getHandlePositions(box, 1, 1) as Array<[Handle, number, number]>) {
    if (Math.abs(px - hx) < HIT && Math.abs(py - hy) < HIT) return name;
  }
  // Inside box = move
  if (px > box.x && px < box.x + box.w && py > box.y && py < box.y + box.h) return 'move';
  return null;
}

function resizeBox(orig: Box, handle: Handle, dx: number, dy: number, ar?: number): Box {
  let { x, y, w, h } = orig;

  switch (handle) {
    case 'nw': x += dx; y += dy; w -= dx; h -= dy; break;
    case 'n':  y += dy; h -= dy; break;
    case 'ne': w += dx; y += dy; h -= dy; break;
    case 'e':  w += dx; break;
    case 'se': w += dx; h += dy; break;
    case 's':  h += dy; break;
    case 'sw': x += dx; w -= dx; h += dy; break;
    case 'w':  x += dx; w -= dx; break;
    default: break;
  }

  // Enforce min size
  w = Math.max(MIN_BOX / 640, w);
  h = Math.max(MIN_BOX / 400, h);

  // Enforce aspect ratio lock
  if (ar) {
    const wByAr = h * ar;
    const hByAr = w / ar;
    if (Math.abs(dx) >= Math.abs(dy)) h = hByAr;
    else w = wByAr;
  }

  // Clamp to canvas
  x = Math.max(0, Math.min(1 - w, x));
  y = Math.max(0, Math.min(1 - h, y));
  w = Math.min(1 - x, w);
  h = Math.min(1 - y, h);

  return { x, y, w, h };
}

function centerBox(ar: number): Box {
  const w = 0.8;
  const h = Math.min(0.8, w / ar);
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Icons                                                                        */
/* ─────────────────────────────────────────────────────────────────────────── */

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="h-8 w-8 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity={0.2} strokeWidth={3} />
      <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
    </svg>
  );
}
