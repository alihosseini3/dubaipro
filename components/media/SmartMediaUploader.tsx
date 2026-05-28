'use client';

/**
 * SmartMediaUploader v2 — production-grade single image upload.
 *
 * Features:
 *  - Drag & drop or click-to-browse
 *  - Local preview with dimensions + compression analysis
 *  - Crop UI (canvas, no external deps)
 *  - Resize preset selection (context-aware)
 *  - SEO panel (alt/title/seoTitle/caption/description/keywords)
 *  - Tags input (folder/entity tagging)
 *  - Duplicate detection via browser SHA-256 + server hash check
 *  - Upload progress (XHR bytes) + processing spinner
 *  - Compression warning (file too heavy for its dimensions)
 *  - Choose From Gallery (MediaPickerDialog)
 *  - Responsive preview after upload (shows AVIF/WebP/JPEG badges)
 *  - RTL support (logical CSS)
 *  - Mobile-friendly, keyboard accessible
 *  - Backwards-compatible: legacy <ImageUpload /> in components/ui is now
 *    a thin adapter around this component.
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
import { CropModal, type CropResult } from './CropModal';
import { MediaPickerDialog } from './MediaPickerDialog';
import { TagsInput } from './TagsInput';

import {
  useUploadQueue,
  analyzeCompression,
  type UploadFormFields,
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
import type {
  MediaContext,
  PipelineResult,
} from '@/lib/media/types';
import type { DuplicateInfo, CompressionWarning } from '@/hooks/use-upload-queue';

const ACCEPT_ATTR = ALLOWED_IMAGE_TYPES.join(',');
const MAX_BYTES   = MAX_IMAGE_BYTES * 8;

/* ─── Public types ───────────────────────────────────────────────────── */

export type UploadedAsset = PipelineResult;

export interface SmartMediaUploaderProps {
  value?: UploadedAsset | null;
  onChange?: (asset: UploadedAsset | null) => void;
  context?: MediaContext;
  folder?: string;
  skipAvif?: boolean;
  entity?: { type: string; id: string; field: string };
  altSuggestion?: string;
  onUploadingChange?: (uploading: boolean) => void;
  label?: string;
  hint?: string;
  className?: string;
  /** Initial tags array passed down to the upload. */
  tags?: string[];
  /** Fires whenever the tag list changes during upload preparation. */
  onTagsChange?: (tags: string[]) => void;
  /** Show a Crop button in the preparing panel. */
  allowCrop?: boolean;
  /** Lock crop to a fixed aspect ratio (e.g. 16/9). */
  cropAspectRatio?: number;
  /** Show 'Choose from Gallery' button. Default: true. */
  showGalleryPicker?: boolean;
}

/* ─── Internal state machine ─────────────────────────────────────────── */

type State =
  | { status: 'idle' }
  | {
      status: 'preparing';
      file:               File;
      objectUrl:          string;
      dims:               { w: number; h: number } | null;
      croppedBlob:        Blob | null;
      croppedObjectUrl:   string | null;
      duplicate:          DuplicateInfo | null;
      compressionWarning: CompressionWarning | null;
      checkingDuplicate:  boolean;
    }
  | { status: 'uploading'; progress: number; processing: boolean; objectUrl: string }
  | { status: 'error'; message: string };

/* ─── Component ──────────────────────────────────────────────────────── */

export function SmartMediaUploader({
  value,
  onChange,
  context,
  folder,
  skipAvif = false,
  entity,
  altSuggestion,
  onUploadingChange,
  label,
  hint,
  className,
  tags: initialTags = [],
  onTagsChange,
  allowCrop = false,
  cropAspectRatio,
  showGalleryPicker = true,
}: SmartMediaUploaderProps) {
  const t    = useTranslations('media.uploader');
  const tCtx = useTranslations('media.context');

  const ctxCfg   = useMemo<MediaContextConfig>(() => getMediaContext(context), [context]);
  const ctxLabel = (() => { try { return tCtx(ctxCfg.i18nKey as never); } catch { return ''; } })();

  const inputRef  = useRef<HTMLInputElement>(null);
  const objUrlRef = useRef<string | null>(null);
  const uploadId  = useRef('smu');

  const [state,        setState]        = useState<State>({ status: 'idle' });
  const [dragOver,     setDragOver]     = useState(false);
  const [seo,          setSeo]          = useState<SeoInputsValue>(EMPTY_SEO_INPUTS);
  const [tags,         setTags]         = useState<string[]>(initialTags);
  const [showCrop,     setShowCrop]     = useState(false);
  const [showGallery,  setShowGallery]  = useState(false);

  const isPreparing = state.status === 'preparing';
  const isUploading = state.status === 'uploading';

  /* sync tags to parent */
  useEffect(() => { onTagsChange?.(tags); }, [tags, onTagsChange]);

  /* upload state → parent */
  useEffect(() => { onUploadingChange?.(isUploading); }, [isUploading, onUploadingChange]);

  /* Revoke object URLs on unmount */
  useEffect(() => {
    return () => {
      if (objUrlRef.current) URL.revokeObjectURL(objUrlRef.current);
    };
  }, []);

  /* ── useUploadQueue ──────────────────────────────────────────────── */

  const { startUpload: queueUpload, abort, checkDuplicate } = useUploadQueue({
    onItemChange: (_id, patch) => {
      if (patch.progress !== undefined) {
        setState((prev) => prev.status === 'uploading' ? { ...prev, progress: patch.progress! } : prev);
      }
      if (patch.processing) {
        setState((prev) => prev.status === 'uploading' ? { ...prev, processing: true } : prev);
      }
    },
    onComplete: (_id, result) => {
      setState({ status: 'idle' });
      onChange?.(result);
    },
    onError: (_id, message) => {
      setState({ status: 'error', message });
    },
    onAbort: (_id) => {
      setState({ status: 'idle' });
    },
  });

  /* ── Validation ───────────────────────────────────────────────────── */

  const validate = useCallback((file: File): string | null => {
    if (!isAllowedMimeType(file.type) || isVideoMimeType(file.type)) return t('errorInvalidType');
    if (file.size === 0)     return t('errorEmpty');
    if (file.size > MAX_BYTES) return t('errorTooLarge');
    return null;
  }, [t]);

  /* ── File picked ─────────────────────────────────────────────────── */

  const handleFiles = useCallback(async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    const file = files instanceof FileList ? files[0] : files[0];
    const err  = validate(file);
    if (err) { setState({ status: 'error', message: err }); return; }

    if (objUrlRef.current) URL.revokeObjectURL(objUrlRef.current);
    const objectUrl = URL.createObjectURL(file);
    objUrlRef.current = objectUrl;

    setSeo({ ...EMPTY_SEO_INPUTS });

    setState({
      status: 'preparing', file, objectUrl,
      dims: null, croppedBlob: null, croppedObjectUrl: null,
      duplicate: null, compressionWarning: null, checkingDuplicate: true,
    });

    /* Probe dims + compression + duplicate in parallel */
    const probe = new window.Image();
    probe.onload = () => {
      const w = probe.naturalWidth;
      const h = probe.naturalHeight;
      const cw = analyzeCompression(file.size, w, h);
      setState((s) =>
        s.status === 'preparing' && s.objectUrl === objectUrl
          ? { ...s, dims: { w, h }, compressionWarning: cw }
          : s,
      );
    };
    probe.src = objectUrl;

    /* Hash + duplicate check */
    const dup = await checkDuplicate(await hashFileFast(file));
    setState((s) =>
      s.status === 'preparing' && s.objectUrl === objectUrl
        ? { ...s, duplicate: dup, checkingDuplicate: false }
        : s,
    );
  }, [validate, checkDuplicate]);

  /* ── Cancel preparing ─────────────────────────────────────────────── */

  const cancelPreparing = useCallback(() => {
    if (objUrlRef.current) { URL.revokeObjectURL(objUrlRef.current); objUrlRef.current = null; }
    if (inputRef.current)  inputRef.current.value = '';
    setState({ status: 'idle' });
  }, []);

  /* ── Crop applied ────────────────────────────────────────────────── */

  const handleCropApply = useCallback((result: CropResult) => {
    setShowCrop(false);
    const cropUrl = URL.createObjectURL(result.blob);
    setState((s) =>
      s.status === 'preparing'
        ? { ...s, croppedBlob: result.blob, croppedObjectUrl: cropUrl }
        : s,
    );
  }, []);

  /* ── Start upload ────────────────────────────────────────────────── */

  const doUpload = useCallback(() => {
    if (state.status !== 'preparing') return;
    const id = uploadId.current;
    const { file, objectUrl, croppedBlob } = state;
    const fields: UploadFormFields = {
      context,  folder, skipAvif,
      alt:         seo.alt,
      title:       seo.title,
      seoTitle:    seo.seoTitle,
      caption:     seo.caption,
      description: seo.description,
      keywords:    seo.keywords.length  ? seo.keywords  : undefined,
      tags:        tags.length          ? tags          : undefined,
      entityType:  entity?.type,
      entityId:    entity?.id,
      field:       entity?.field,
      croppedBlob: croppedBlob ?? undefined,
    };
    setState({ status: 'uploading', progress: 0, processing: false, objectUrl });
    void queueUpload(id, file, fields);
  }, [state, context, folder, skipAvif, seo, tags, entity, queueUpload]);

  /* ── Gallery pick ────────────────────────────────────────────────── */

  const handleGalleryPick = useCallback((assets: UploadedAsset[]) => {
    setShowGallery(false);
    if (assets[0]) onChange?.(assets[0]);
  }, [onChange]);

  /* ── Remove asset ────────────────────────────────────────────────── */

  const removeAsset = useCallback(() => { onChange?.(null); setSeo(EMPTY_SEO_INPUTS); }, [onChange]);

  /* ── Dropzone ────────────────────────────────────────────────────── */

  const onFileInput  = (e: ChangeEvent<HTMLInputElement>) => { void handleFiles(e.target.files); e.target.value = ''; };
  const onDrop       = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragOver(false); if (isUploading || isPreparing || value) return; void handleFiles(e.dataTransfer.files); };
  const onDragOver   = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); if (!isUploading && !isPreparing && !value) setDragOver(true); };
  const onDragLeave  = () => setDragOver(false);
  const openPicker   = () => inputRef.current?.click();

  /* ── Derived ─────────────────────────────────────────────────────── */

  const dimensionWarning = isPreparing && state.status === 'preparing' && state.dims
    ? (state.dims.w < ctxCfg.minWidth || state.dims.h < ctxCfg.minHeight)
      ? t('dimensionWarning', { min: `${ctxCfg.minWidth}×${ctxCfg.minHeight}` })
      : null
    : null;

  /* ── Render ──────────────────────────────────────────────────────── */

  return (
    <div className={className}>
      {/* Header */}
      {(label || ctxLabel) && (
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium text-slate-700">{label || ctxLabel}</label>
          <div className="flex items-center gap-2">
            {ctxCfg.suggestedRatio && (
              <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                {t('ratioHint', { ratio: ctxCfg.suggestedRatio })}
              </span>
            )}
            {showGalleryPicker && !value && !isPreparing && !isUploading && (
              <button type="button" onClick={() => setShowGallery(true)}
                className="flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 transition hover:bg-indigo-100">
                <GalleryIcon className="h-3 w-3" /> Gallery
              </button>
            )}
          </div>
        </div>
      )}

      <input ref={inputRef} type="file" accept={ACCEPT_ATTR} className="sr-only" onChange={onFileInput} />

      {/* PREPARING */}
      {isPreparing && state.status === 'preparing' && (
        <PreparingPanel
          objectUrl={state.croppedObjectUrl ?? state.objectUrl}
          file={state.file}
          dims={state.dims}
          ctxCfg={ctxCfg}
          dimensionWarning={dimensionWarning}
          compressionWarning={state.compressionWarning}
          duplicate={state.duplicate}
          checkingDuplicate={state.checkingDuplicate}
          seo={seo}
          onSeoChange={setSeo}
          tags={tags}
          onTagsChange={setTags}
          altSuggestion={altSuggestion}
          allowCrop={allowCrop}
          hasCrop={!!state.croppedBlob}
          onCropOpen={() => setShowCrop(true)}
          onUpload={doUpload}
          onCancel={cancelPreparing}
        />
      )}

      {/* IDLE / UPLOADING / DONE */}
      {!isPreparing && (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={
            'group relative overflow-hidden rounded-2xl border-2 border-dashed bg-white shadow-sm transition-all duration-200 ' +
            (value ? 'border-slate-200'
              : dragOver ? 'border-slate-900 bg-slate-50 shadow-md'
              : 'border-slate-300 hover:border-slate-500 hover:bg-slate-50/60')
          }
        >
          {value ? (
            <CompletedPanel asset={value} onReplace={() => { removeAsset(); openPicker(); }} onRemove={removeAsset} />
          ) : isUploading && state.status === 'uploading' ? (
            <UploadingPanel objectUrl={state.objectUrl} progress={state.progress} processing={state.processing} onCancel={() => abort(uploadId.current)} />
          ) : (
            <EmptyDropzone
              onClick={openPicker}
              onGallery={showGalleryPicker ? () => setShowGallery(true) : undefined}
              ctxLabel={ctxLabel}
              ratio={ctxCfg.suggestedRatio}
              minHint={ctxCfg.minWidth > 0 ? t('minDimensionHint', { w: String(ctxCfg.minWidth), h: String(ctxCfg.minHeight) }) : undefined}
            />
          )}
        </div>
      )}

      {/* Error */}
      {state.status === 'error' && (
        <p role="alert" className="mt-2 flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          <ErrorIcon /> {state.message}
        </p>
      )}

      {hint && state.status !== 'error' && !isPreparing && !value && (
        <p className="mt-2 text-xs text-slate-500">{hint}</p>
      )}

      {/* Crop modal */}
      {showCrop && isPreparing && state.status === 'preparing' && (
        <CropModal
          src={state.objectUrl}
          aspectRatio={cropAspectRatio}
          onApply={handleCropApply}
          onCancel={() => setShowCrop(false)}
        />
      )}

      {/* Gallery picker */}
      {showGallery && (
        <MediaPickerDialog
          mode="single"
          initialFolder={folder}
          onClose={() => setShowGallery(false)}
          onPick={handleGalleryPick}
        />
      )}
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────────── */

function EmptyDropzone({
  onClick,
  onGallery,
  ctxLabel,
  ratio,
  minHint,
}: {
  onClick:    () => void;
  onGallery?: () => void;
  ctxLabel?:  string;
  ratio?:     string;
  minHint?:   string;
}) {
  const t = useTranslations('media.uploader');
  return (
    <div className="flex w-full flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      {ctxLabel && (
        <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-0.5 text-[11px] font-semibold text-indigo-700">
          {ctxLabel}
        </span>
      )}
      <button type="button" onClick={onClick} className="flex flex-col items-center gap-3 transition-colors">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition-transform group-hover:scale-105 group-hover:bg-slate-200">
          <UploadIcon />
        </span>
        <span className="space-y-1">
          <span className="block text-sm font-semibold text-slate-900">{t('dropTitle')}</span>
          <span className="block text-xs text-slate-500">{t('dropSubtitle')}</span>
        </span>
        <span className="mt-1 inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition group-hover:border-slate-900">
          {t('browse')}
        </span>
      </button>
      {onGallery && (
        <button type="button" onClick={onGallery}
          className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 transition hover:text-indigo-800">
          <GalleryIcon className="h-3.5 w-3.5" /> Choose from Gallery
        </button>
      )}
      {(ratio || minHint) && (
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          {ratio && <span>{t('ratioHint', { ratio })}</span>}
          {ratio && minHint && <span>·</span>}
          {minHint && <span>{minHint}</span>}
        </div>
      )}
    </div>
  );
}

function PreparingPanel({
  objectUrl, file, dims, ctxCfg, dimensionWarning, compressionWarning, duplicate,
  checkingDuplicate, seo, onSeoChange, tags, onTagsChange, altSuggestion,
  allowCrop, hasCrop, onCropOpen, onUpload, onCancel,
}: {
  objectUrl:          string;
  file:               File;
  dims:               { w: number; h: number } | null;
  ctxCfg:             MediaContextConfig;
  dimensionWarning:   string | null;
  compressionWarning: CompressionWarning | null;
  duplicate:          DuplicateInfo | null;
  checkingDuplicate:  boolean;
  seo:                SeoInputsValue;
  onSeoChange:        (v: SeoInputsValue) => void;
  tags:               string[];
  onTagsChange:       (t: string[]) => void;
  altSuggestion?:     string;
  allowCrop:          boolean;
  hasCrop:            boolean;
  onCropOpen:         () => void;
  onUpload:           () => void;
  onCancel:           () => void;
}) {
  const t    = useTranslations('media.uploader');
  const tSeo = useTranslations('media.seo');
  const altMissing = seo.alt.trim().length === 0;
  const fmtSize    = formatBytes(file.size);

  return (
    <div className="overflow-hidden rounded-2xl border border-indigo-200 bg-indigo-50/40 shadow-sm">
      {/* Preview */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={objectUrl} alt="" className="h-full w-full object-contain" />
        <span className="absolute bottom-2 start-2 rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
          {dims ? `${dims.w} × ${dims.h}` : '…'} · {fmtSize}
        </span>
        {ctxCfg.suggestedRatio && (
          <span className="absolute end-2 top-2 rounded-md bg-indigo-600/90 px-2 py-0.5 text-[10px] font-bold text-white shadow">
            {ctxCfg.suggestedRatio}
          </span>
        )}
        {allowCrop && (
          <button type="button" onClick={onCropOpen}
            className={`absolute start-2 top-2 flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold shadow transition ${
              hasCrop ? 'bg-emerald-500/90 text-white' : 'bg-black/60 text-white hover:bg-black/80'
            }`}>
            <CropIcon />
            {hasCrop ? 'Cropped ✓' : 'Crop'}
          </button>
        )}
      </div>

      {/* Duplicate warning */}
      {checkingDuplicate && (
        <div className="flex items-center gap-2 border-b border-blue-100 bg-blue-50 px-4 py-1.5 text-[11px] text-blue-700">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
          Checking for duplicates…
        </div>
      )}
      {duplicate && !checkingDuplicate && (
        <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-[11px] font-medium text-amber-800">
          <WarnIcon />
          Duplicate detected — a similar image already exists in the gallery.
          <a href={duplicate.url} target="_blank" rel="noopener noreferrer"
            className="ms-1 underline">View</a>
        </div>
      )}

      {/* Dimension warning */}
      {dimensionWarning && (
        <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-[11px] font-medium text-amber-800">
          <WarnIcon />{dimensionWarning}
        </div>
      )}

      {/* Compression warning */}
      {compressionWarning && (
        <div className="flex items-start gap-2 border-b border-orange-200 bg-orange-50 px-4 py-2 text-[11px] font-medium text-orange-800">
          <WarnIcon />
          File appears over-compressed or unoptimized: {compressionWarning.fileSizeKb}KB (expected ≤{compressionWarning.expectedMaxKb}KB for this resolution).
        </div>
      )}

      {/* SEO + Tags */}
      <div className="space-y-3 border-t border-indigo-100 bg-white px-4 py-3">
        <p className="text-xs font-semibold text-slate-700">{tSeo('title')}</p>
        <SeoInputsPanel value={seo} onChange={onSeoChange} altSuggestion={altSuggestion} />
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Tags</p>
          <TagsInput value={tags} onChange={onTagsChange} placeholder="Add tag and press Enter" />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-2 border-t border-indigo-100 bg-indigo-50/60 px-4 py-2.5">
        <p className="truncate text-[11px] text-slate-500" title={file.name}>{file.name}</p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onCancel}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-900">
            {t('cancel')}
          </button>
          <button type="button" onClick={onUpload} disabled={altMissing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
            <UploadIcon className="h-3.5 w-3.5" />{t('upload')}
          </button>
        </div>
      </div>
    </div>
  );
}

function UploadingPanel({
  objectUrl, progress, processing, onCancel,
}: {
  objectUrl:  string;
  progress:   number;
  processing: boolean;
  onCancel:   () => void;
}) {
  const t = useTranslations('media.uploader');
  return (
    <div className="relative">
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={objectUrl} alt="" className="h-full w-full object-contain opacity-60" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/30 backdrop-blur-[2px]">
          <Spinner />
          <p className="text-xs font-semibold text-white">
            {processing ? t('processing') : t('uploading')}
          </p>
          {!processing && (
            <>
              <div className="h-1.5 w-48 overflow-hidden rounded-full bg-white/30">
                <div className="h-full rounded-full bg-white transition-all duration-200" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-[10px] font-bold tabular-nums text-white">{progress}%</p>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center justify-end border-t border-slate-200 bg-white px-4 py-2.5">
        <button type="button" onClick={onCancel}
          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:border-red-600 hover:bg-red-50">
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}

function CompletedPanel({
  asset,
  onReplace,
  onRemove,
}: {
  asset: UploadedAsset;
  onReplace: () => void;
  onRemove: () => void;
}) {
  const t = useTranslations('media.uploader');
  const filename = asset.url.split('/').pop() ?? 'image';
  const savings = Math.round((asset.compressionRatio ?? 0) * 100);
  const variantsCount = asset.variants?.length ?? 0;

  return (
    <div className="relative">
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-100">
        {asset.blurDataURL && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={asset.blurDataURL}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full scale-110 object-cover blur-xl"
          />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset.url}
          alt=""
          className="relative h-full w-full animate-fadeIn object-contain"
        />
        {/* Score badge */}
        <ScoreBadge score={asset.optimizationScore} />
        {/* Stats overlay */}
        <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
          {asset.width} × {asset.height} · {formatBytes(asset.size)}
          {savings > 0 && (
            <span className="ms-1 text-emerald-300">
              · {t('savings', { pct: String(savings) })}
            </span>
          )}
        </span>
        {/* Download */}
        <a
          href={asset.url}
          download={filename}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-black/60 text-white backdrop-blur-sm transition hover:bg-black/80"
          title={t('download')}
        >
          <DownloadIcon />
        </a>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] text-slate-400" title={filename}>
            {filename}
          </p>
          {variantsCount > 0 && (
            <p className="text-[10px] text-emerald-600">
              {t('variants', { count: String(variantsCount) })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onReplace}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-900"
          >
            <ReplaceIcon /> {t('replace')}
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:border-red-600 hover:bg-red-50"
          >
            <TrashIcon /> {t('remove')}
          </button>
        </div>
      </div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const t = useTranslations('media.uploader');
  const tone =
    score >= 80
      ? 'bg-emerald-500/95'
      : score >= 60
      ? 'bg-amber-500/95'
      : 'bg-red-500/95';
  return (
    <span
      className={`absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow ${tone}`}
      title={t('scoreLabel')}
    >
      <span className="text-[8px]">●</span>
      {score} / 100
    </span>
  );
}

/* ─── Tiny utilities & icons ─────────────────────────────────────────── */

/** Fast file hash using first + last 64KB slices to avoid reading huge files. */
async function hashFileFast(file: File): Promise<string> {
  const SLICE = 65536;
  const head  = file.slice(0, SLICE);
  const tail  = file.size > SLICE ? file.slice(-SLICE) : new Blob([]);
  const combined = new Blob([head, tail]);
  const buf    = await combined.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function UploadIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 16V4" />
      <path d="M6 10l6-6 6 6" />
      <path d="M4 20h16" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  );
}

function ReplaceIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
      aria-hidden
    >
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
      aria-hidden
    >
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  );
}

function GalleryIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M4 16l4-4 4 4 4-8 4 8M3 3h18v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3z" />
    </svg>
  );
}

function CropIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" aria-hidden>
      <path d="M6.13 1L6 16a2 2 0 0 0 2 2h15M1 6.13l15-.13a2 2 0 0 1 2 2V23" />
    </svg>
  );
}

function WarnIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="h-6 w-6 animate-spin text-white" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity={0.25} strokeWidth={4} />
      <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth={4} strokeLinecap="round" />
    </svg>
  );
}
