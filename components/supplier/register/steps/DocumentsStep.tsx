'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { SupplierDocumentType } from '@prisma/client';

import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  ALLOWED_VIDEO_MIME_TYPES,
  DOCUMENT_LIMITS,
  MIN_STORE_PHOTOS,
  type SupplierRegistrationState
} from '@/lib/supplier/registration';

import { ERROR, HINT, SECTION_TITLE, isImageUrl } from '../fields';

export type DocItem = SupplierRegistrationState['documents'][number];

const DOC_ACCEPT = ALLOWED_DOCUMENT_MIME_TYPES.join(',');
const VIDEO_ACCEPT = ALLOWED_VIDEO_MIME_TYPES.join(',');

type Props = {
  documents: DocItem[];
  uploadingType: SupplierDocumentType | null;
  onFiles: (type: SupplierDocumentType, files: FileList) => void;
  onDelete: (id: string) => void;
  errors: Record<string, string>;
};

export function DocumentsStep({
  documents,
  uploadingType,
  onFiles,
  onDelete,
  errors
}: Props) {
  const t = useTranslations('supplierRegister');

  const byType = useMemo(() => {
    const map = new Map<SupplierDocumentType, DocItem[]>();
    for (const d of documents) {
      const arr = map.get(d.type) ?? [];
      arr.push(d);
      map.set(d.type, arr);
    }
    return map;
  }, [documents]);

  const storePhotoCount = byType.get('STORE_PHOTO')?.length ?? 0;
  const video = byType.get('STORE_VIDEO')?.[0];

  return (
    <div className="grid gap-6">
      {/* Required verification documents */}
      <section className="grid gap-3">
        <h3 className={SECTION_TITLE}>{t('verificationDocs')}</h3>
        {(['TRADE_LICENSE', 'PASSPORT'] as const).map((type) => {
          const doc = byType.get(type)?.[0];
          const isUploading = uploadingType === type;
          return (
            <div
              key={type}
              className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    {type === 'TRADE_LICENSE' ? t('tradeLicenseDoc') : t('passportDoc')}
                    <span className="ms-1 text-rose-500">*</span>
                  </p>
                  {doc ? (
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-emerald-600 hover:underline"
                    >
                      {t('uploadedViewFile')}
                    </a>
                  ) : (
                    <p className={HINT}>{t('docHint')}</p>
                  )}
                </div>
                <label className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700">
                  {isUploading ? t('uploading') : doc ? t('replace') : t('upload')}
                  <input
                    type="file"
                    className="hidden"
                    accept={DOC_ACCEPT}
                    disabled={isUploading}
                    onChange={(e) => {
                      if (e.target.files?.length) onFiles(type, e.target.files);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
              {doc && isImageUrl(doc.fileUrl) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={doc.fileUrl}
                  alt=""
                  className="mt-3 h-24 w-auto rounded-lg border border-slate-100 object-cover dark:border-slate-700"
                />
              )}
              {errors[type] && <p className={ERROR}>{errors[type]}</p>}
            </div>
          );
        })}
      </section>

      <Gallery
        title={t('storePhotos')}
        hint={t('storePhotosHint', {
          min: MIN_STORE_PHOTOS,
          max: DOCUMENT_LIMITS.STORE_PHOTO
        })}
        type="STORE_PHOTO"
        items={byType.get('STORE_PHOTO') ?? []}
        limit={DOCUMENT_LIMITS.STORE_PHOTO}
        required
        min={MIN_STORE_PHOTOS}
        count={storePhotoCount}
        uploading={uploadingType === 'STORE_PHOTO'}
        error={errors.STORE_PHOTO}
        onFiles={onFiles}
        onDelete={onDelete}
      />

      <Gallery
        title={t('warehousePhotos')}
        hint={t('warehousePhotosHint', { max: DOCUMENT_LIMITS.WAREHOUSE_PHOTO })}
        type="WAREHOUSE_PHOTO"
        items={byType.get('WAREHOUSE_PHOTO') ?? []}
        limit={DOCUMENT_LIMITS.WAREHOUSE_PHOTO}
        uploading={uploadingType === 'WAREHOUSE_PHOTO'}
        error={errors.WAREHOUSE_PHOTO}
        onFiles={onFiles}
        onDelete={onDelete}
      />

      {/* Store video */}
      <section className="grid gap-3">
        <div>
          <h3 className={SECTION_TITLE}>{t('storeVideo')}</h3>
          <p className={HINT}>{t('storeVideoHint')}</p>
        </div>
        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          {video ? (
            <div className="space-y-3">
              <video
                src={video.fileUrl}
                controls
                className="max-h-56 w-full rounded-lg bg-black"
              />
              <button
                type="button"
                onClick={() => onDelete(video.id)}
                className="text-xs font-semibold text-rose-600 hover:underline"
              >
                {t('removeVideo')}
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 py-8 text-center transition hover:border-orange-300 hover:bg-orange-50/40 dark:border-slate-600 dark:hover:bg-orange-900/10">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                className="h-8 w-8 text-slate-400"
                aria-hidden
              >
                <path d="M15 10l4.5-2.5v9L15 14M4 6h11v12H4z" strokeLinejoin="round" />
              </svg>
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                {uploadingType === 'STORE_VIDEO' ? t('uploading') : t('uploadVideo')}
              </span>
              <input
                type="file"
                className="hidden"
                accept={VIDEO_ACCEPT}
                disabled={uploadingType === 'STORE_VIDEO'}
                onChange={(e) => {
                  if (e.target.files?.length) onFiles('STORE_VIDEO', e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
          )}
          {errors.STORE_VIDEO && <p className={ERROR}>{errors.STORE_VIDEO}</p>}
        </div>
      </section>
    </div>
  );
}

/* ── Gallery uploader ─────────────────────────────────────────────────── */

function Gallery({
  title,
  hint,
  type,
  items,
  limit,
  required,
  min,
  count,
  uploading,
  error,
  onFiles,
  onDelete
}: {
  title: string;
  hint: string;
  type: SupplierDocumentType;
  items: DocItem[];
  limit: number;
  required?: boolean;
  min?: number;
  count?: number;
  uploading: boolean;
  error?: string;
  onFiles: (type: SupplierDocumentType, files: FileList) => void;
  onDelete: (id: string) => void;
}) {
  const t = useTranslations('supplierRegister');
  const atLimit = items.length >= limit;
  const enough = min == null || (count ?? items.length) >= min;

  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className={SECTION_TITLE}>
            {title}
            {required && <span className="ms-1 text-rose-500">*</span>}
          </h3>
          <p className={HINT}>{hint}</p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            enough ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
          }`}
        >
          {min
            ? t('uploadedCountMin', { count: items.length, min })
            : t('uploadedCount', { count: items.length })}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
        {items.map((d) => (
          <div
            key={d.id}
            className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
          >
            {isImageUrl(d.fileUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={d.fileUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                {t('filePlaceholder')}
              </div>
            )}
            <button
              type="button"
              onClick={() => onDelete(d.id)}
              className="absolute end-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
              aria-label={t('remove')}
            >
              <svg
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="h-3.5 w-3.5"
                aria-hidden
              >
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            </button>
          </div>
        ))}

        {!atLimit && (
          <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-200 text-center transition hover:border-orange-300 hover:bg-orange-50/40 dark:border-slate-600 dark:hover:bg-orange-900/10">
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="h-5 w-5 text-slate-400"
              aria-hidden
            >
              <path d="M10 4v12M4 10h12" />
            </svg>
            <span className="px-1 text-[11px] font-medium text-slate-500">
              {uploading ? t('uploading') : t('addFile')}
            </span>
            <input
              type="file"
              className="hidden"
              accept={DOC_ACCEPT}
              multiple
              disabled={uploading}
              onChange={(e) => {
                if (e.target.files?.length) onFiles(type, e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        )}
      </div>
      {error && <p className={ERROR}>{error}</p>}
    </section>
  );
}
