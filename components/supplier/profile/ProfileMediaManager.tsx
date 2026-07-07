'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { SupplierDocumentType } from '@prisma/client';

import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  ALLOWED_VIDEO_MIME_TYPES,
  DOCUMENT_LIMITS,
  MAX_DOCUMENT_BYTES,
  MAX_VIDEO_BYTES,
  MIN_STORE_PHOTOS,
  isAllowedDocumentMime,
  isAllowedVideoMime,
} from '@/lib/supplier/registration';

export type MediaDoc = {
  id: string;
  type: SupplierDocumentType;
  fileUrl: string;
  createdAt: string;
};

const DOC_ACCEPT = ALLOWED_DOCUMENT_MIME_TYPES.join(',');
const VIDEO_ACCEPT = ALLOWED_VIDEO_MIME_TYPES.join(',');

function isImageUrl(url: string): boolean {
  return /\.(jpe?g|png|webp|gif)$/i.test(url);
}

export function ProfileMediaManager({ initialDocuments }: { initialDocuments: MediaDoc[] }) {
  const t = useTranslations('supplier.profile');
  const [documents, setDocuments] = useState<MediaDoc[]>(initialDocuments);
  const [uploadingType, setUploadingType] = useState<SupplierDocumentType | null>(null);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  const byType = useMemo(() => {
    const map = new Map<SupplierDocumentType, MediaDoc[]>();
    for (const d of documents) {
      const arr = map.get(d.type) ?? [];
      arr.push(d);
      map.set(d.type, arr);
    }
    return map;
  }, [documents]);

  const storePhotoCount = byType.get('STORE_PHOTO')?.length ?? 0;

  async function uploadOne(type: SupplierDocumentType, file: File): Promise<MediaDoc> {
    const isVideo = type === 'STORE_VIDEO';
    const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_DOCUMENT_BYTES;
    if (file.size > maxBytes) {
      throw new Error(`File exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB limit`);
    }
    const mimeOk = isVideo ? isAllowedVideoMime(file.type) : isAllowedDocumentMime(file.type);
    if (!mimeOk) throw new Error(isVideo ? 'Allowed: MP4, WEBM, MOV' : 'Allowed: PDF, JPG, PNG, WEBP');

    const fd = new FormData();
    fd.append('file', file);
    fd.append('type', type);
    const res = await fetch('/api/supplier/upload', { method: 'POST', body: fd });
    const json = (await res.json().catch(() => ({}))) as { data?: MediaDoc; error?: string };
    if (!res.ok || !json.data) throw new Error(json.error ?? 'Upload failed');
    return json.data;
  }

  async function handleFiles(type: SupplierDocumentType, files: FileList) {
    setErrors((e) => ({ ...e, [type]: undefined }));
    setUploadingType(type);
    const isGallery = type === 'STORE_PHOTO' || type === 'WAREHOUSE_PHOTO';
    try {
      for (const file of Array.from(files)) {
        const current = documents.filter((d) => d.type === type).length;
        if (isGallery && current >= DOCUMENT_LIMITS[type]) {
          setErrors((e) => ({ ...e, [type]: `Maximum ${DOCUMENT_LIMITS[type]} files` }));
          break;
        }
        // eslint-disable-next-line no-await-in-loop
        const uploaded = await uploadOne(type, file);
        setDocuments((prev) =>
          isGallery ? [...prev, uploaded] : [...prev.filter((d) => d.type !== type), uploaded]
        );
      }
    } catch (err) {
      setErrors((e) => ({ ...e, [type]: err instanceof Error ? err.message : 'Upload failed' }));
    } finally {
      setUploadingType(null);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/supplier/upload?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? 'Delete failed');
      }
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      setErrors((e) => ({ ...e, general: err instanceof Error ? err.message : 'Delete failed' }));
    }
  }

  return (
    <div className="grid gap-6">
      {errors.general && (
        <p className="text-xs font-medium text-red-600">{errors.general}</p>
      )}

      {/* Verification documents */}
      <section className="grid gap-3">
        <h3 className="text-sm font-semibold text-slate-800">{t('verificationDocs')}</h3>
        {(['TRADE_LICENSE', 'PASSPORT'] as const).map((type) => {
          const doc = byType.get(type)?.[0];
          const isUploading = uploadingType === type;
          return (
            <div key={type} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {type === 'TRADE_LICENSE' ? t('tradeLicense') : t('emiratesIdPassport')}
                  </p>
                  {doc ? (
                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-emerald-600 hover:underline">
                      {t('uploadedViewFile')}
                    </a>
                  ) : (
                    <p className="text-xs text-slate-400">{t('uploadHint')}</p>
                  )}
                </div>
                <label className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                  {isUploading ? t('uploading') : doc ? t('replace') : t('upload')}
                  <input
                    type="file"
                    className="hidden"
                    accept={DOC_ACCEPT}
                    disabled={isUploading}
                    onChange={(e) => {
                      if (e.target.files?.length) void handleFiles(type, e.target.files);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
              {doc && isImageUrl(doc.fileUrl) && (
                <img src={doc.fileUrl} alt="" className="mt-3 h-24 w-auto rounded-lg border border-slate-100 object-cover" />
              )}
              {errors[type] && <p className="mt-1 text-xs font-medium text-red-600">{errors[type]}</p>}
            </div>
          );
        })}
      </section>

      <Gallery
        title={t('storePhotos')}
        hint={t('storePhotosHint', { min: MIN_STORE_PHOTOS, max: DOCUMENT_LIMITS.STORE_PHOTO })}
        t={t}
        type="STORE_PHOTO"
        items={byType.get('STORE_PHOTO') ?? []}
        limit={DOCUMENT_LIMITS.STORE_PHOTO}
        min={MIN_STORE_PHOTOS}
        count={storePhotoCount}
        uploading={uploadingType === 'STORE_PHOTO'}
        error={errors.STORE_PHOTO}
        accept={DOC_ACCEPT}
        onFiles={handleFiles}
        onDelete={handleDelete}
      />

      <Gallery
        title={t('warehousePhotos')}
        hint={t('warehousePhotosHint', { max: DOCUMENT_LIMITS.WAREHOUSE_PHOTO })}
        t={t}
        type="WAREHOUSE_PHOTO"
        items={byType.get('WAREHOUSE_PHOTO') ?? []}
        limit={DOCUMENT_LIMITS.WAREHOUSE_PHOTO}
        uploading={uploadingType === 'WAREHOUSE_PHOTO'}
        error={errors.WAREHOUSE_PHOTO}
        accept={DOC_ACCEPT}
        onFiles={handleFiles}
        onDelete={handleDelete}
      />

      {/* Store video */}
      <section className="grid gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{t('storeVideo')}</h3>
          <p className="text-xs text-slate-400">{t('storeVideoHint')}</p>
        </div>
        {(() => {
          const video = byType.get('STORE_VIDEO')?.[0];
          const isUploading = uploadingType === 'STORE_VIDEO';
          return (
            <div className="rounded-xl border border-slate-200 p-4">
              {video ? (
                <div className="space-y-3">
                  <video src={video.fileUrl} controls className="max-h-56 w-full rounded-lg bg-black" />
                  <button type="button" onClick={() => void handleDelete(video.id)} className="text-xs font-semibold text-red-600 hover:underline">
                    {t('removeVideo')}
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 py-8 text-center transition hover:border-orange-300 hover:bg-orange-50/40">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-8 w-8 text-slate-400" aria-hidden>
                    <path d="M15 10l4.5-2.5v9L15 14M4 6h11v12H4z" strokeLinejoin="round" />
                  </svg>
                  <span className="text-sm font-medium text-slate-600">
                    {isUploading ? t('uploading') : t('clickUploadVideo')}
                  </span>
                  <input type="file" className="hidden" accept={VIDEO_ACCEPT} disabled={isUploading} onChange={(e) => { if (e.target.files?.length) void handleFiles('STORE_VIDEO', e.target.files); e.target.value = ''; }} />
                </label>
              )}
              {errors.STORE_VIDEO && <p className="mt-1 text-xs font-medium text-red-600">{errors.STORE_VIDEO}</p>}
            </div>
          );
        })()}
      </section>
    </div>
  );
}

function Gallery({
  title,
  hint,
  type,
  items,
  limit,
  min,
  count,
  uploading,
  error,
  accept,
  onFiles,
  onDelete,
  t,
}: {
  title: string;
  hint: string;
  type: SupplierDocumentType;
  items: MediaDoc[];
  limit: number;
  min?: number;
  count?: number;
  uploading: boolean;
  error?: string;
  accept: string;
  onFiles: (type: SupplierDocumentType, files: FileList) => void;
  onDelete: (id: string) => void;
  t: (key: string) => string;
}) {
  const atLimit = items.length >= limit;
  const enough = min == null || (count ?? items.length) >= min;
  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          <p className="text-xs text-slate-400">{hint}</p>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${enough ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
          {items.length}{min ? ` / ${min}+` : ''}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
        {items.map((d) => (
          <div key={d.id} className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            {isImageUrl(d.fileUrl) ? (
              <img src={d.fileUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">File</div>
            )}
            <button
              type="button"
              onClick={() => onDelete(d.id)}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
              aria-label="Remove"
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-3.5 w-3.5" aria-hidden>
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            </button>
          </div>
        ))}
        {!atLimit && (
          <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-200 text-center transition hover:border-orange-300 hover:bg-orange-50/40">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5 text-slate-400" aria-hidden>
              <path d="M10 4v12M4 10h12" />
            </svg>
            <span className="px-1 text-[11px] font-medium text-slate-500">{uploading ? t('uploading') : t('addPhoto')}</span>
            <input type="file" className="hidden" accept={accept} multiple disabled={uploading} onChange={(e) => { if (e.target.files?.length) onFiles(type, e.target.files); e.target.value = ''; }} />
          </label>
        )}
      </div>
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
    </section>
  );
}
