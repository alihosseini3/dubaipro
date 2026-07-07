'use client';

/**
 * MultiSmartMediaUploader v2 — gallery-style uploader on top of the
 * Smart Media Engine.
 *
 * New in v2 (P4):
 *  - Duplicate detection per file before upload
 *  - Compression warnings
 *  - Choose from Gallery button (MediaPickerDialog)
 *  - Tags input shared across all pending uploads
 *  - Per-file crop (CropModal) accessible from queue item
 *  - Uses useUploadQueue hook (no inline XHR boilerplate)
 *  - RTL-safe, keyboard accessible
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import { useTranslations } from 'next-intl';

import {
  EMPTY_SEO_INPUTS,
  SeoInputsPanel,
  type SeoInputsValue,
} from './SeoInputsPanel';
import type { UploadedAsset } from './SmartMediaUploader';
import { CropModal, type CropResult } from './CropModal';
import { MediaPickerDialog } from './MediaPickerDialog';
import { TagsInput } from './TagsInput';

import {
  useUploadQueue,
  analyzeCompression,
  type CompressionWarning,
  type DuplicateInfo,
} from '@/hooks/use-upload-queue';
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  isAllowedMimeType,
  isVideoMimeType,
} from '@/lib/upload/config';
import {
  getMediaContext,
  type MediaContextConfig,
} from '@/lib/media/context';
import type { MediaContext, PipelineResult } from '@/lib/media/types';

const ACCEPT_ATTR = ALLOWED_IMAGE_TYPES.join(',');
const MAX_BYTES = MAX_IMAGE_BYTES * 8;

/* ─── Public types ───────────────────────────────────────────────────── */

export interface MultiSmartMediaUploaderProps {
  value:               UploadedAsset[];
  onChange:            (assets: UploadedAsset[]) => void;
  context?:            MediaContext;
  folder?:             string;
  skipAvif?:           boolean;
  maxItems?:           number;
  entity?:             { type: string; id: string; field: string };
  onUploadingChange?:  (uploading: boolean) => void;
  label?:              string;
  hint?:               string;
  className?:          string;
  /** Show 'Choose from Gallery' button. Default: true. */
  showGalleryPicker?:  boolean;
  /** Enable per-file crop button. */
  allowCrop?:          boolean;
  cropAspectRatio?:    number;
}

/* ─── In-flight queue item ───────────────────────────────────────────── */

interface PendingItem {
  id:                 string;
  file:               File;
  objectUrl:          string;
  croppedBlob:        Blob | null;
  croppedObjectUrl:   string | null;
  progress:           number;
  processing:         boolean;
  duplicate:          DuplicateInfo | null;
  compressionWarning: CompressionWarning | null;
  checkingDuplicate:  boolean;
  error?:             string;
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function MultiSmartMediaUploader({
  value,
  onChange,
  context,
  folder,
  skipAvif = false,
  maxItems = 12,
  entity,
  onUploadingChange,
  label,
  hint,
  className,
  showGalleryPicker = true,
  allowCrop = false,
  cropAspectRatio,
}: MultiSmartMediaUploaderProps) {
  const t = useTranslations('media.uploader');
  const tCtx = useTranslations('media.context');

  const ctxCfg = useMemo<MediaContextConfig>(() => getMediaContext(context), [context]);
  const ctxLabel = (() => {
    try { return tCtx(ctxCfg.i18nKey as never); } catch { return ''; }
  })();

  const inputRef     = useRef<HTMLInputElement>(null);
  const latestValue  = useRef(value);
  latestValue.current = value;

  const [pending,     setPending]    = useState<PendingItem[]>([]);
  const [error,       setError]      = useState<string | null>(null);
  const [dragOver,    setDragOver]   = useState(false);
  const [editingId,   setEditingId]  = useState<string | null>(null);
  const [tags,        setTags]       = useState<string[]>([]);
  const [showGallery, setShowGallery] = useState(false);
  const [cropItemId,  setCropItemId]  = useState<string | null>(null);

  const slotsLeft   = Math.max(0, maxItems - value.length - pending.length);
  const isUploading = pending.some((p) => !p.error);

  useEffect(() => { onUploadingChange?.(isUploading); }, [isUploading, onUploadingChange]);

  /* Cleanup on unmount */
  useEffect(() => {
    return () => {
      pending.forEach((p) => {
        URL.revokeObjectURL(p.objectUrl);
        if (p.croppedObjectUrl) URL.revokeObjectURL(p.croppedObjectUrl);
      });
      abortAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Validation ───────────────────────────────────────────────────── */

  const validate = useCallback((f: File): string | null => {
    if (!isAllowedMimeType(f.type) || isVideoMimeType(f.type)) return t('errorInvalidType');
    if (f.size === 0) return t('errorEmpty');
    if (f.size > MAX_BYTES) return t('errorTooLarge');
    return null;
  }, [t]);

  /* ── useUploadQueue ──────────────────────────────────────────────── */

  const { startUpload: queueUpload, abort, abortAll, checkDuplicate } = useUploadQueue({
    onItemChange: (id, patch) => {
      setPending((prev) => prev.map((p) => p.id !== id ? p : {
        ...p,
        progress:   patch.progress   ?? p.progress,
        processing: patch.processing ?? p.processing,
      }));
    },
    onComplete: (id, result) => {
      setPending((prev) => {
        const found = prev.find((q) => q.id === id);
        if (found) { URL.revokeObjectURL(found.objectUrl); if (found.croppedObjectUrl) URL.revokeObjectURL(found.croppedObjectUrl); }
        return prev.filter((q) => q.id !== id);
      });
      onChange([...latestValue.current, result].slice(0, maxItems));
    },
    onError: (id, message) => {
      setPending((prev) => prev.map((p) => p.id !== id ? p : { ...p, error: message }));
    },
    onAbort: (id) => {
      setPending((prev) => {
        const found = prev.find((q) => q.id === id);
        if (found) { URL.revokeObjectURL(found.objectUrl); if (found.croppedObjectUrl) URL.revokeObjectURL(found.croppedObjectUrl); }
        return prev.filter((q) => q.id !== id);
      });
    },
  });

  /* ── Add file ────────────────────────────────────────────────────── */

  const addFile = useCallback(async (file: File) => {
    const id        = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const objectUrl = URL.createObjectURL(file);
    const item: PendingItem = {
      id, file, objectUrl, croppedBlob: null, croppedObjectUrl: null,
      progress: 0, processing: false,
      duplicate: null, compressionWarning: null, checkingDuplicate: true,
    };
    setPending((prev) => [...prev, item]);

    const probe = new window.Image();
    probe.onload = () => {
      const cw = analyzeCompression(file.size, probe.naturalWidth, probe.naturalHeight);
      setPending((prev) => prev.map((p) => p.id !== id ? p : { ...p, compressionWarning: cw }));
    };
    probe.src = objectUrl;

    const hashBuf = await new Blob([file.slice(0, 65536), file.size > 65536 ? file.slice(-65536) : new Blob([])]).arrayBuffer();
    const hashHex = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', hashBuf))).map((b) => b.toString(16).padStart(2, '0')).join('');
    const dup = await checkDuplicate(hashHex);
    setPending((prev) => prev.map((p) => p.id !== id ? p : { ...p, duplicate: dup, checkingDuplicate: false }));

    void queueUpload(id, file, {
      context, folder, skipAvif,
      tags: tags.length ? tags : undefined,
      entityType: entity?.type, entityId: entity?.id, field: entity?.field,
    });
  }, [checkDuplicate, queueUpload, context, folder, skipAvif, tags, entity]);

  /* ── Crop apply ──────────────────────────────────────────────────── */

  const handleCropApply = useCallback((result: CropResult) => {
    const id = cropItemId;
    setCropItemId(null);
    if (!id) return;
    const cropUrl = URL.createObjectURL(result.blob);
    setPending((prev) => prev.map((p) => p.id !== id ? p : { ...p, croppedBlob: result.blob, croppedObjectUrl: cropUrl }));
    abort(id);
    const item = pending.find((p) => p.id === id);
    if (!item) return;
    void queueUpload(id, item.file, {
      context, folder, skipAvif, croppedBlob: result.blob,
      tags: tags.length ? tags : undefined,
      entityType: entity?.type, entityId: entity?.id, field: entity?.field,
    });
  }, [cropItemId, abort, queueUpload, pending, context, folder, skipAvif, tags, entity]);

  /* ── Handlers ────────────────────────────────────────────────────── */

  const handleFiles = useCallback((files: FileList | File[] | null) => {
    if (!files) return;
    const list = Array.from(files).slice(0, slotsLeft);
    if (list.length === 0) return;
    setError(null);
    for (const f of list) {
      const err = validate(f);
      if (err) { setError(err); continue; }
      void addFile(f);
    }
  }, [slotsLeft, addFile, validate]);

  const handleGalleryPick = useCallback((assets: UploadedAsset[]) => {
    setShowGallery(false);
    onChange([...latestValue.current, ...assets].slice(0, maxItems));
  }, [onChange, maxItems]);

  const onFileInput = (e: ChangeEvent<HTMLInputElement>) => { handleFiles(e.target.files); e.target.value = ''; };
  const onDrop      = (e: DragEvent<HTMLDivElement>)    => { e.preventDefault(); setDragOver(false); if (slotsLeft === 0) return; handleFiles(e.dataTransfer.files); };
  const onDragOver  = (e: DragEvent<HTMLDivElement>)    => { e.preventDefault(); if (slotsLeft > 0) setDragOver(true); };
  const openPicker  = () => inputRef.current?.click();

  /* ── Reorder / remove ────────────────────────────────────────────── */

  const move = (i: number, delta: -1 | 1) => {
    const j = i + delta;
    if (j < 0 || j >= value.length) return;
    const next = value.slice(); [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const removeAt = (i: number) => {
    const removed = value[i];
    onChange(value.filter((_, idx) => idx !== i));
    if (editingId === removed.id) setEditingId(null);
  };
  const cancelPending = (id: string) => {
    const item = pending.find((p) => p.id === id);
    if (!item) return;
    if (item.error) { setPending((prev) => prev.filter((p) => p.id !== id)); URL.revokeObjectURL(item.objectUrl); }
    else { abort(id); }
  };

  /* ── Render ───────────────────────────────────────────────────────── */

  return (
    <div className={className}>
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700">
          {label || ctxLabel || t('dropTitle')}
          <span className="ms-1.5 text-xs font-normal text-slate-500">{value.length}/{maxItems}</span>
        </label>
        <div className="flex items-center gap-2">
          {ctxCfg.suggestedRatio && (
            <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
              {t('ratioHint', { ratio: ctxCfg.suggestedRatio })}
            </span>
          )}
          {showGalleryPicker && slotsLeft > 0 && (
            <button type="button" onClick={() => setShowGallery(true)}
              className="flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 transition hover:bg-indigo-100">
              Gallery
            </button>
          )}
        </div>
      </div>

      {/* Tags */}
      {pending.length > 0 && (
        <div className="mb-2">
          <TagsInput value={tags} onChange={setTags} placeholder="Tags for all uploads" />
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTR}
        className="sr-only"
        onChange={onFileInput}
      />

      <div
        onDragOver={onDragOver}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={
          'rounded-2xl border-2 border-dashed bg-white shadow-sm transition-all duration-200 ' +
          (dragOver
            ? 'border-slate-900 bg-slate-50 shadow-md'
            : 'border-slate-300 hover:border-slate-500')
        }
      >
        {value.length === 0 && pending.length === 0 ? (
          <button
            type="button"
            onClick={openPicker}
            className="flex w-full flex-col items-center justify-center gap-2 px-6 py-10 text-center"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-700">
              <UploadIcon />
            </span>
            <span className="text-sm font-semibold text-slate-900">{t('dropTitle')}</span>
            <span className="text-xs text-slate-500">{t('dropSubtitle')}</span>
            <span className="mt-2 inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
              {t('browse')}
            </span>
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 md:grid-cols-4">
            {value.map((asset, i) => (
              <AssetTile
                key={asset.id}
                asset={asset}
                isCover={i === 0}
                isFirst={i === 0}
                isLast={i === value.length - 1}
                isEditing={editingId === asset.id}
                onMoveLeft={() => move(i, -1)}
                onMoveRight={() => move(i, +1)}
                onRemove={() => removeAt(i)}
                onToggleEdit={() => setEditingId(editingId === asset.id ? null : asset.id)}
              />
            ))}
            {pending.map((p) => (
              <PendingTile
                key={p.id}
                item={p}
                onCancel={() => cancelPending(p.id)}
                allowCrop={allowCrop}
                onCropOpen={() => setCropItemId(p.id)}
              />
            ))}
            {slotsLeft > 0 && pending.length === 0 && value.length > 0 && (
              <button
                type="button"
                onClick={openPicker}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 transition hover:border-slate-900 hover:text-slate-900"
              >
                <UploadIcon />
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  {t('browse')}
                </span>
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
      {!error && hint && <p className="mt-2 text-xs text-slate-500">{hint}</p>}

      {/* Per-asset SEO drawer */}
      {editingId && (
        <SeoDrawer
          key={editingId}
          asset={value.find((a) => a.id === editingId)!}
          onClose={() => setEditingId(null)}
        />
      )}

      {/* Crop modal */}
      {cropItemId && (() => {
        const ci = pending.find((p) => p.id === cropItemId);
        return ci ? (
          <CropModal
            src={ci.objectUrl}
            aspectRatio={cropAspectRatio}
            onApply={handleCropApply}
            onCancel={() => setCropItemId(null)}
          />
        ) : null;
      })()}

      {/* Gallery picker */}
      {showGallery && (
        <MediaPickerDialog
          mode="multi"
          initialFolder={folder}
          selectedIds={value.map((a) => a.id)}
          onClose={() => setShowGallery(false)}
          onPick={handleGalleryPick}
        />
      )}
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────────── */

function AssetTile({
  asset, isCover, isFirst, isLast, isEditing,
  onMoveLeft, onMoveRight, onRemove, onToggleEdit,
}: {
  asset: UploadedAsset;
  isCover: boolean;
  isFirst: boolean;
  isLast: boolean;
  isEditing: boolean;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onRemove: () => void;
  onToggleEdit: () => void;
}) {
  const t = useTranslations('media.uploader');
  return (
    <figure
      className={`group relative overflow-hidden rounded-xl border bg-slate-50 transition ${
        isEditing ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-slate-200'
      }`}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-white">
        {asset.blurDataURL && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={asset.blurDataURL} alt="" aria-hidden
            className="absolute inset-0 h-full w-full scale-110 object-cover blur-xl" />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset.url} alt={asset.url}
          className="relative h-full w-full object-cover" loading="lazy" />
        {asset.width && (
          <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white">
            {asset.width}×{asset.height}
          </span>
        )}
        <ScoreBadge score={asset.optimizationScore} />
      </div>
      {isCover && (
        <span className="pointer-events-none absolute end-2 top-2 inline-flex items-center rounded-full bg-orange-500/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow">
          ★
        </span>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
        <div className="flex gap-1">
          <ToolButton onClick={onMoveLeft} disabled={isFirst} label={t('replace')}>
            <Arrow dir="left" />
          </ToolButton>
          <ToolButton onClick={onMoveRight} disabled={isLast} label={t('replace')}>
            <Arrow dir="right" />
          </ToolButton>
          <ToolButton onClick={onToggleEdit} label="SEO">
            <PenIcon />
          </ToolButton>
        </div>
        <ToolButton onClick={onRemove} label={t('remove')} danger>
          <TrashIcon />
        </ToolButton>
      </div>
    </figure>
  );
}

function PendingTile({ item, onCancel, allowCrop, onCropOpen }: { item: PendingItem; onCancel: () => void; allowCrop: boolean; onCropOpen: () => void }) {
  const t = useTranslations('media.uploader');
  return (
    <figure className="relative overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50">
      {/* Warnings row */}
      {(item.duplicate || item.compressionWarning) && (
        <div className="flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
          ⚠ {item.duplicate ? 'Duplicate' : 'Heavy'}
        </div>
      )}
      <div className="relative aspect-square w-full overflow-hidden bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.croppedObjectUrl ?? item.objectUrl} alt="" className="h-full w-full object-cover opacity-60" />
        {allowCrop && !item.error && (
          <button type="button" onClick={onCropOpen}
            className="absolute start-1 top-1 rounded bg-black/60 p-1 text-white transition hover:bg-black/80">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
              <path d="M6.13 1L6 16a2 2 0 0 0 2 2h15M1 6.13l15-.13a2 2 0 0 1 2 2V23" />
            </svg>
          </button>
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/30">
          {item.error ? (
            <>
              <span className="rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">!</span>
              <p className="px-2 text-center text-[10px] text-white">{item.error}</p>
            </>
          ) : item.processing ? (
            <Spinner />
          ) : (
            <>
              <Spinner />
              <div className="h-1 w-3/4 overflow-hidden rounded-full bg-white/30">
                <div className="h-full bg-white transition-all" style={{ width: `${item.progress}%` }} />
              </div>
              <p className="text-[10px] font-bold tabular-nums text-white">{item.progress}%</p>
            </>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onCancel}
        title={t('cancel')}
        className="absolute end-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-md bg-black/70 text-white transition hover:bg-black"
      >
        ×
      </button>
    </figure>
  );
}

function SeoDrawer({ asset, onClose }: { asset: UploadedAsset; onClose: () => void }) {
  const t = useTranslations('media.uploader');
  const tSeo = useTranslations('media.seo');
  const [seo, setSeo] = useState<SeoInputsValue>(EMPTY_SEO_INPUTS);
  const [status, setStatus] = useState<'idle' | 'loading' | 'saving' | 'saved' | 'error'>('loading');

  /* Hydrate from server. */
  useEffect(() => {
    let alive = true;
    setStatus('loading');
    fetch(`/api/media/${asset.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive) return;
        const a = j?.data;
        setSeo({
          alt:         a?.alt ?? '',
          title:       a?.title ?? '',
          seoTitle:    a?.seoTitle ?? '',
          caption:     a?.caption ?? '',
          description: a?.description ?? '',
          keywords:    Array.isArray(a?.keywords) ? a.keywords : [],
        });
        setStatus('idle');
      })
      .catch(() => alive && setStatus('error'));
    return () => { alive = false; };
  }, [asset.id]);

  const save = async () => {
    setStatus('saving');
    try {
      const res = await fetch(`/api/media/${asset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(seo),
      });
      setStatus(res.ok ? 'saved' : 'error');
    } catch { setStatus('error'); }
    setTimeout(() => setStatus('idle'), 2500);
  };

  return (
    <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-700">{tSeo('title')}</p>
        <button type="button" onClick={onClose}
          className="rounded p-1 text-slate-400 hover:text-slate-700">×</button>
      </div>
      {status === 'loading' ? (
        <div className="py-6 text-center"><Spinner /></div>
      ) : (
        <>
          <SeoInputsPanel value={seo} onChange={setSeo} />
          <div className="mt-3 flex justify-end">
            <button type="button" onClick={save} disabled={status === 'saving'}
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-60 ${
                status === 'saved' ? 'bg-green-600' :
                status === 'error' ? 'bg-red-600' :
                'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {status === 'saving' ? '…' :
               status === 'saved' ? '✓' :
               status === 'error' ? '!' : '💾'}
              {' '}
              {status === 'saved' ? t('upload') : t('upload')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Tiny shared UI ─────────────────────────────────────────────────── */

function ScoreBadge({ score }: { score: number }) {
  const tone = score >= 80 ? 'bg-emerald-500/95'
             : score >= 60 ? 'bg-amber-500/95'
             : 'bg-red-500/95';
  return (
    <span className={`absolute start-1 top-1 inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white shadow ${tone}`}>
      {score}
    </span>
  );
}

function ToolButton({
  children, onClick, disabled, label, danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-white shadow transition disabled:opacity-30 ${
        danger ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-900/80 hover:bg-slate-900'
      }`}
    >
      {children}
    </button>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 16V4M6 10l6-6 6 6M4 20h16" />
    </svg>
  );
}
function PenIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
      <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}
function Arrow({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
      <path d={dir === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
    </svg>
  );
}
function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin text-white" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity={0.25} strokeWidth={4} />
      <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth={4} strokeLinecap="round" />
    </svg>
  );
}
