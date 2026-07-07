'use client';

/**
 * RfqAttachmentUploader — document + image attachments for RFQ create/edit.
 *
 * Features:
 *  - Drag & drop or click-to-browse
 *  - Multi-file support (max 10)
 *  - Supported: PDF, DOCX, XLSX, images (JPEG, PNG, WebP)
 *  - Max 10 MB per file
 *  - File type icons + preview for images
 *  - Progress tracking per file
 *  - Remove/reorder actions
 *  - Media Library integration (choose existing files)
 *  - Attachment changes trigger quote staleness on edit
 *  - RTL-safe, mobile-friendly
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import { useTranslations } from 'next-intl';

import { MediaPickerDialog } from '@/components/media/MediaPickerDialog';
import type { UploadedAsset } from '@/components/media/SmartMediaUploader';

/* ─── Config ────────────────────────────────────────────────────────── */

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.xlsx', '.jpg', '.jpeg', '.png', '.webp'];

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_FILES = 10;

/* ─── Types ─────────────────────────────────────────────────────────── */

export interface RfqAttachment {
  id: string;
  url: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
}

interface PendingItem {
  id: string;
  file: File;
  progress: number;
  error?: string;
}

export interface RfqAttachmentUploaderProps {
  value: RfqAttachment[];
  onChange: (attachments: RfqAttachment[]) => void;
  /** Called when attachments are modified (add/remove/reorder) for staleness tracking */
  onAttachmentsModified?: () => void;
  folder?: string;
  label?: string;
  hint?: string;
  className?: string;
  disabled?: boolean;
}

/* ─── Component ───────────────────────────────────────────────────────── */

export function RfqAttachmentUploader({
  value,
  onChange,
  onAttachmentsModified,
  folder = 'rfq-attachments',
  label,
  hint,
  className,
  disabled = false,
}: RfqAttachmentUploaderProps) {
  const t = useTranslations('rfqMarketplace.attachments');
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [showGallery, setShowGallery] = useState(false);

  const slotsLeft = Math.max(0, MAX_FILES - value.length - pending.length);
  const isUploading = pending.length > 0 && !pending.every((p) => p.error);

  /* Cleanup on unmount */
  useEffect(() => {
    return () => {
      pending.forEach((p) => {
        if (p.error) return;
        // Abort any in-flight uploads
      });
    };
  }, []);

  /* ── Validation ───────────────────────────────────────────────────── */

  const validateFile = useCallback((file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type as typeof ALLOWED_TYPES[number])) {
      return t('errorInvalidType');
    }
    if (file.size === 0) return t('errorEmpty');
    if (file.size > MAX_FILE_BYTES) return t('errorTooLarge', { max: '10MB' });
    return null;
  }, [t]);

  /* ── Upload logic ─────────────────────────────────────────────────── */

  const uploadFile = useCallback(async (item: PendingItem) => {
    const formData = new FormData();
    formData.append('file', item.file);
    formData.append('folder', folder);
    formData.append('context', 'rfq-attachment');

    try {
      const res = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(err.error || 'Upload failed');
      }

      const result = await res.json();
      const asset: RfqAttachment = {
        id: result.data.id,
        url: result.data.url,
        name: result.data.originalName || item.file.name,
        mimeType: result.data.mimeType,
        size: result.data.size,
      };

      setPending((prev) => prev.filter((p) => p.id !== item.id));
      onChange([...value, asset].slice(0, MAX_FILES));
      onAttachmentsModified?.();
    } catch (err) {
      setPending((prev) =>
        prev.map((p) =>
          p.id === item.id ? { ...p, error: err instanceof Error ? err.message : 'Upload failed' } : p
        )
      );
    }
  }, [folder, onChange, onAttachmentsModified, value]);

  const addFiles = useCallback((files: FileList | File[] | null) => {
    if (!files || slotsLeft <= 0) return;

    const fileList = Array.from(files).slice(0, slotsLeft);
    const newItems: PendingItem[] = [];

    for (const file of fileList) {
      const error = validateFile(file);
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      newItems.push({ id, file, progress: 0, error: error || undefined });
    }

    setPending((prev) => [...prev, ...newItems]);

    // Start uploads for valid files
    for (const item of newItems) {
      if (!item.error) {
        void uploadFile(item);
      }
    }
  }, [slotsLeft, validateFile, uploadFile]);

  /* ── Event handlers ─────────────────────────────────────────────────── */

  const onFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files);
    e.target.value = '';
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled || slotsLeft <= 0) return;
    addFiles(e.dataTransfer.files);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled && slotsLeft > 0) setDragOver(true);
  };

  const openPicker = () => inputRef.current?.click();

  /* ── Actions ────────────────────────────────────────────────────────── */

  const removeAt = (index: number) => {
    const removed = value[index];
    onChange(value.filter((_, i) => i !== index));
    onAttachmentsModified?.();
    // Note: We don't delete from storage here - attachments may be shared
  };

  const move = (index: number, delta: -1 | 1) => {
    const newIndex = index + delta;
    if (newIndex < 0 || newIndex >= value.length) return;
    const next = value.slice();
    [next[index], next[newIndex]] = [next[newIndex], next[index]];
    onChange(next);
    onAttachmentsModified?.();
  };

  const cancelPending = (id: string) => {
    setPending((prev) => prev.filter((p) => p.id !== id));
  };

  const handleGalleryPick = (assets: UploadedAsset[]) => {
    setShowGallery(false);
    const newAttachments: RfqAttachment[] = assets
      .filter((a) => ALLOWED_TYPES.includes(a.mimeType as typeof ALLOWED_TYPES[number]))
      .slice(0, slotsLeft)
      .map((a) => ({
        id: a.id,
        url: a.url,
        name: a.url.split('/').pop() || a.id,
        mimeType: a.mimeType,
        size: a.size,
      }));

    if (newAttachments.length > 0) {
      onChange([...value, ...newAttachments].slice(0, MAX_FILES));
      onAttachmentsModified?.();
    }
  };

  /* ── Render helpers ─────────────────────────────────────────────────── */

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon />;
    if (mimeType.includes('pdf')) return <PdfIcon />;
    if (mimeType.includes('word') || mimeType.includes('document')) return <DocIcon />;
    if (mimeType.includes('excel') || mimeType.includes('sheet')) return <SheetIcon />;
    return <FileIcon />;
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  /* ── Render ─────────────────────────────────────────────────────────── */

  return (
    <div className={className}>
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700">
          {label || t('title')}
          <span className="ms-1.5 text-xs font-normal text-slate-500">
            {value.length}/{MAX_FILES}
          </span>
        </label>
        <button
          type="button"
          onClick={() => setShowGallery(true)}
          disabled={disabled || slotsLeft <= 0}
          className="flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50"
        >
          {t('fromGallery')}
        </button>
      </div>

      {/* Dropzone */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ALLOWED_EXTENSIONS.join(',')}
        className="sr-only"
        onChange={onFileInput}
        disabled={disabled || slotsLeft <= 0}
      />

      <div
        onDragOver={onDragOver}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={
          'rounded-2xl border-2 border-dashed bg-white shadow-sm transition-all duration-200 ' +
          (disabled
            ? 'border-slate-200 bg-slate-50'
            : dragOver
              ? 'border-slate-900 bg-slate-50 shadow-md'
              : 'border-slate-300 hover:border-slate-500')
        }
      >
        {value.length === 0 && pending.length === 0 ? (
          <button
            type="button"
            onClick={openPicker}
            disabled={disabled}
            className="flex w-full flex-col items-center justify-center gap-2 px-6 py-10 text-center disabled:opacity-50"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-700">
              <UploadIcon />
            </span>
            <span className="text-sm font-semibold text-slate-900">{t('dropTitle')}</span>
            <span className="text-xs text-slate-500">{t('dropSubtitle')}</span>
            <span className="mt-2 inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
              {t('browse')}
            </span>
            <span className="text-[10px] text-slate-400">{t('supportedTypes')}</span>
          </button>
        ) : (
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
            {value.map((att, i) => (
              <AttachmentTile
                key={att.id}
                attachment={att}
                index={i}
                isFirst={i === 0}
                isLast={i === value.length - 1}
                onMoveUp={() => move(i, -1)}
                onMoveDown={() => move(i, 1)}
                onRemove={() => removeAt(i)}
                getFileIcon={getFileIcon}
                formatSize={formatSize}
                t={t}
              />
            ))}
            {pending.map((p) => (
              <PendingTile
                key={p.id}
                item={p}
                onCancel={() => cancelPending(p.id)}
              />
            ))}
            {slotsLeft > 0 && !disabled && (
              <button
                type="button"
                onClick={openPicker}
                className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 transition hover:border-slate-900 hover:text-slate-900"
              >
                <UploadIcon />
                <span className="text-[11px] font-semibold uppercase tracking-wider">{t('addMore')}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {hint && <p className="mt-2 text-xs text-slate-500">{hint}</p>}

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

/* ─── Sub-components ──────────────────────────────────────────────────── */

function AttachmentTile({
  attachment,
  index,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onRemove,
  getFileIcon,
  formatSize,
  t,
}: {
  attachment: RfqAttachment;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  getFileIcon: (mime: string) => React.ReactNode;
  formatSize: (bytes: number) => string;
  t: (key: string, params?: Record<string, string>) => string;
}) {
  const isImage = attachment.mimeType?.startsWith('image/');

  return (
    <figure className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50 transition hover:border-slate-300">
      {/* Preview area */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-white">
        {isImage ? (
          <img
            src={attachment.url}
            alt={attachment.name}
            className="relative h-full w-full object-contain"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-400">
            <span className="scale-150">{getFileIcon(attachment.mimeType ?? '')}</span>
            <span className="text-[10px] uppercase tracking-wider text-slate-300">
              {attachment.mimeType?.split('/').pop()?.toUpperCase()}
            </span>
          </div>
        )}

        {/* Overlay actions */}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
          <div className="flex gap-1">
            <ToolButton onClick={onMoveUp} disabled={isFirst} label={t('moveUp')}>
              <Arrow dir="up" />
            </ToolButton>
            <ToolButton onClick={onMoveDown} disabled={isLast} label={t('moveDown')}>
              <Arrow dir="down" />
            </ToolButton>
            <a
              href={attachment.url}
              download={attachment.name}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-slate-900/80 text-white shadow transition hover:bg-slate-900"
              title={t('download')}
            >
              <DownloadIcon />
            </a>
          </div>
          <ToolButton onClick={onRemove} danger label={t('remove')}>
            <TrashIcon />
          </ToolButton>
        </div>
      </div>

      {/* Info */}
      <div className="border-t border-slate-200 bg-white px-3 py-2">
        <p className="truncate text-xs font-medium text-slate-700" title={attachment.name}>
          {attachment.name}
        </p>
        {attachment.size != null && (
          <p className="text-[10px] text-slate-400">{formatSize(attachment.size)}</p>
        )}
      </div>

      {/* Index badge */}
      <span className="pointer-events-none absolute end-2 top-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-slate-900/70 px-1.5 text-[10px] font-bold text-white">
        {index + 1}
      </span>
    </figure>
  );
}

function PendingTile({
  item,
  onCancel,
}: {
  item: PendingItem;
  onCancel: () => void;
}) {
  return (
    <figure className="relative overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 opacity-70">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-white">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-100">
          {item.error ? (
            <>
              <span className="rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">!</span>
              <p className="px-2 text-center text-[10px] text-red-600">{item.error}</p>
            </>
          ) : (
            <>
              <Spinner />
              <p className="text-[10px] text-slate-500">{item.file.name}</p>
            </>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="absolute end-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-md bg-black/70 text-white transition hover:bg-black"
        title="Cancel"
      >
        ×
      </button>
    </figure>
  );
}

function ToolButton({
  children,
  onClick,
  disabled,
  label,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-white shadow transition disabled:opacity-30 ${
        danger ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-900/80 hover:bg-slate-900'
      }`}
    >
      {children}
    </button>
  );
}

/* ─── Icons ───────────────────────────────────────────────────────────── */

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 16V4M6 10l6-6 6 6M4 20h16" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" />
    </svg>
  );
}

function Arrow({ dir }: { dir: 'up' | 'down' | 'left' | 'right' }) {
  const d =
    dir === 'up' ? 'M18 15l-6-6-6 6' :
    dir === 'down' ? 'M6 9l6 6 6-6' :
    dir === 'left' ? 'M15 18l-6-6 6-6' :
    'M9 18l6-6-6-6';
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d={d} />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M9 13l6 6M9 19l6-6" strokeOpacity={0.3} />
      <path d="M9.5 12.5v5M9.5 15h2a1.5 1.5 0 0 0 0-3h-2v5" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function SheetIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin text-slate-400" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity={0.25} strokeWidth={4} />
      <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth={4} strokeLinecap="round" />
    </svg>
  );
}
