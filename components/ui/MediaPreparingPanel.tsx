'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';

import { UploadSettings, DEFAULT_UPLOAD_CONFIG, type UploadConfig } from '@/components/ui/UploadSettings';
import { getContextConfig, type UploadContext } from '@/lib/upload/context';

export type PreparingSeoMeta = { alt: string; title: string; caption: string };

export interface MediaPreparingPanelProps {
  /** The picked file awaiting SEO confirmation. */
  file: File;
  /** Drives default folder, ratio hint, and minimum-dimension warnings. */
  context?: UploadContext;
  /** Optional batch counter, e.g. "2 / 5". */
  queuePosition?: { index: number; total: number };
  /** Fires when the user clicks Upload — parent must perform the actual XHR. */
  onUpload: (meta: PreparingSeoMeta, config: UploadConfig) => void;
  /** Fires when the user clicks Cancel — discard the file. */
  onCancel: () => void;
}

/**
 * Compact modal that confirms SEO metadata BEFORE the file leaves the
 * browser. Rendered through a portal so it sits above the editor it was
 * triggered from — keeps the host page calm and the writer focused.
 *
 * Self-contained: creates and revokes the object URL, reads natural
 * dimensions, owns its own SEO + UploadConfig state. Closes on Escape
 * or backdrop click (both treated as cancel).
 */
export function MediaPreparingPanel({
  file,
  context,
  queuePosition,
  onUpload,
  onCancel,
}: MediaPreparingPanelProps) {
  const t = useTranslations('upload');
  const ctxCfg = getContextConfig(context);

  const objectUrlRef = useRef<string>('');
  if (!objectUrlRef.current) objectUrlRef.current = URL.createObjectURL(file);

  const [mounted, setMounted] = useState(false);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  /* NOTE: we deliberately do NOT pre-fill alt with the filename. If the
   * admin leaves alt empty, the server runs AI Vision inline after upload
   * and fills alt/title/caption/keywords automatically. Pre-filling alt
   * would suppress that auto-fill. The filename is shown as a placeholder
   * hint instead. */
  const filenameHint = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
  const [alt, setAlt] = useState('');
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [config, setConfig] = useState<UploadConfig>(() => ({
    ...DEFAULT_UPLOAD_CONFIG,
    maxDimension: ctxCfg.maxDimension,
  }));

  /* Portal target only available client-side. */
  useEffect(() => {
    setMounted(true);
  }, []);

  /* Read intrinsic dimensions + cleanup. */
  useEffect(() => {
    const url = objectUrlRef.current;
    const img = new window.Image();
    img.onload = () => setDims({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
    return () => {
      URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Lock body scroll + close on Escape. */
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onCancel]);

  const fmtSize = (b: number) =>
    b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

  /* Alt is no longer a hard requirement: when the admin leaves it empty
   * the server runs AI Vision inline and fills alt / title / caption /
   * keywords automatically. The label still nudges the admin to provide
   * their own copy, but Upload is enabled either way. */

  if (!mounted) return null;

  const dialog = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm"
      onMouseDown={(e) => {
        // Close only when the click started on the backdrop itself.
        if (e.target === e.currentTarget) onCancel();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">
              {t('seoTitle')}
            </span>
            {queuePosition && (
              <span className="rounded-md bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                {queuePosition.index} / {queuePosition.total}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label={t('cancel') as string}
            className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* Compact preview */}
          <div className="relative max-h-44 overflow-hidden bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={objectUrlRef.current}
              alt=""
              className="mx-auto block max-h-44 w-auto object-contain"
            />
            <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
              {dims ? `${dims.w} × ${dims.h} · ` : ''}
              {fmtSize(file.size)}
            </span>
            {ctxCfg.suggestedRatio && (
              <span className="absolute bottom-1.5 right-1.5 rounded-md bg-amber-500/95 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                {ctxCfg.label} · {ctxCfg.suggestedRatio}
              </span>
            )}
          </div>

          <div className="space-y-2.5 px-3 py-3">
            {/* Context hint */}
            <div className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
              <span className="mt-0.5 text-[13px] leading-none">💡</span>
              <span>
                <span className="font-semibold">{ctxCfg.label}: </span>
                {ctxCfg.hint}
              </span>
            </div>

            {/* SEO form */}
            <div>
              <label className="mb-0.5 block text-[11px] font-medium text-slate-600">
                {t('seoAltLabel')}{' '}
                <span className="text-red-500">{t('seoAltRequired')}</span>
              </label>
              <input
                autoFocus
                value={alt}
                onChange={(e) => setAlt(e.target.value)}
                placeholder={filenameHint || (t('seoAltPlaceholder') as string)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
              />
              <p className="mt-0.5 text-[10px] text-slate-400">
                {t('seoAltHint')}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-0.5 block text-[11px] font-medium text-slate-600">
                  {t('seoTitleLabel')}
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('seoTitlePlaceholder')}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
                />
              </div>
              <div>
                <label className="mb-0.5 block text-[11px] font-medium text-slate-600">
                  {t('seoCaptionLabel')}
                </label>
                <input
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder={t('seoCaptionPlaceholder')}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
                />
              </div>
            </div>

            {/* Upload settings */}
            <UploadSettings value={config} onChange={setConfig} />
          </div>
        </div>

        {/* Sticky footer */}
        <div className="flex gap-2 border-t border-slate-100 bg-slate-50/60 px-3 py-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-900"
          >
            {t('cancel') as string}
          </button>
          <button
            type="button"
            onClick={() =>
              onUpload(
                { alt: alt.trim(), title: title.trim(), caption: caption.trim() },
                config,
              )
            }
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
            {t('upload') as string}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
