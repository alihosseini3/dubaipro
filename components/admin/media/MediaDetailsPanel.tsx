'use client';

import { SmartImage } from '@/components/ui/SmartImage';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { fmtDate, fmtSize, PRESET_FOLDERS, type MediaAsset } from './types';

const Ic = ({ d, className = 'h-4 w-4' }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d={d} />
  </svg>
);

type Props = {
  asset: MediaAsset;
  copied: string | null;
  folderOptions?: string[];
  onClose(): void;
  onCopy(): void;
  onDelete(): void;
  onSave(data: Partial<Pick<MediaAsset, 'alt' | 'title' | 'caption' | 'originalName' | 'folder' | 'tags'>>): Promise<void>;
};

export function MediaDetailsPanel({ asset, copied, folderOptions = [], onClose, onCopy, onDelete, onSave }: Props) {
  const t = useTranslations('admin.gallery');
  const [alt,     setAlt]     = useState(asset.alt ?? '');
  const [title,   setTitle]   = useState(asset.title ?? '');
  const [caption, setCaption] = useState(asset.caption ?? '');
  const [fname,   setFname]   = useState(asset.originalName);
  const [folder,  setFolder]  = useState(asset.folder);
  const [tagIn,   setTagIn]   = useState('');
  const [tags,    setTags]    = useState<string[]>(asset.tags ?? []);
  const [saving,  setSaving]  = useState(false);
  const [dirty,   setDirty]   = useState(false);

  /* reset when asset changes */
  useEffect(() => {
    setAlt(asset.alt ?? ''); setTitle(asset.title ?? '');
    setCaption(asset.caption ?? ''); setFname(asset.originalName);
    setFolder(asset.folder); setTags(asset.tags ?? []);
    setDirty(false);
  }, [asset.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const mark = () => setDirty(true);

  const addTag = () => {
    const t = tagIn.trim().toLowerCase();
    if (t && !tags.includes(t)) { setTags((p) => [...p, t]); setDirty(true); }
    setTagIn('');
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      alt: alt.trim() || null,
      title: title.trim() || null,
      caption: caption.trim() || null,
      originalName: fname.trim() || asset.originalName,
      folder,
      tags,
    });
    setSaving(false);
    setDirty(false);
  };

  const allFolders = Array.from(new Set([...PRESET_FOLDERS, ...folderOptions]));
  const isVideo = asset.mimeType.startsWith('video/');
  const score   = asset.optimizationScore;

  return (
    <aside className="flex w-80 shrink-0 flex-col border-s border-slate-200 bg-white shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">{t('detailsTitle')}</p>
        <button type="button" onClick={onClose}
          className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
          <Ic d="M18 6L6 18M6 6l12 12" />
        </button>
      </div>

      {/* Preview */}
      <div className="relative h-44 shrink-0 overflow-hidden bg-slate-900">
        {isVideo ? (
          <video src={asset.url} muted preload="metadata"
            className="h-full w-full object-contain" />
        ) : (
          <SmartImage src={asset.url} alt={asset.alt || asset.originalName}
            thumbnailUrl={asset.thumbnailUrl || undefined}
            sizes="320px"
            className="absolute inset-0 h-full w-full object-contain"
            style={asset.dominantColor ? { backgroundColor: asset.dominantColor } : undefined}
          />
        )}
        {/* SEO score pill */}
        {score !== null && score !== undefined && (
          <span className={`absolute bottom-2 end-2 rounded-lg px-2 py-0.5 text-[11px] font-bold backdrop-blur-sm
            ${score >= 80 ? 'bg-emerald-500/80 text-white' : score >= 60 ? 'bg-amber-500/80 text-white' : 'bg-red-500/80 text-white'}`}>
            {t('detailScore')}: {score}
          </span>
        )}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* File info grid */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 rounded-xl bg-slate-50 px-3 py-3 text-[11px]">
          <MetaRow label={t('detailType')}>{asset.mimeType}</MetaRow>
          <MetaRow label={t('detailSize')}>{fmtSize(asset.size)}</MetaRow>
          {asset.width && asset.height && (
            <MetaRow label={t('detailDimensions')}>{asset.width}×{asset.height}</MetaRow>
          )}
          <MetaRow label={t('detailFolder')} className="capitalize">{asset.folder}</MetaRow>
          <MetaRow label={t('detailUploaded')}>{fmtDate(asset.createdAt)}</MetaRow>
          {asset.uploadedBy && (
            <MetaRow label={t('detailUploadedBy')}>{asset.uploadedBy.name}</MetaRow>
          )}
        </div>

        {/* Editable fields */}
        <Field label={t('detailFilename')}>
          <input value={fname} onChange={(e) => { setFname(e.target.value); mark(); }}
            className={cls} maxLength={255} />
        </Field>

        <Field label={t('detailAlt')} hint={!alt ? t('altMissing') : undefined}>
          <input value={alt} onChange={(e) => { setAlt(e.target.value); mark(); }}
            className={`${cls} ${!alt ? 'border-amber-300 bg-amber-50 focus:border-amber-400 focus:ring-amber-100' : ''}`}
            placeholder={t('altPlaceholder')} maxLength={255} />
        </Field>

        <Field label={t('detailTitleField')}>
          <input value={title} onChange={(e) => { setTitle(e.target.value); mark(); }}
            className={cls} maxLength={255} />
        </Field>

        <Field label={t('detailCaption')}>
          <textarea value={caption} onChange={(e) => { setCaption(e.target.value); mark(); }}
            rows={2} className={cls} maxLength={500} />
        </Field>

        <Field label={t('detailFolder')}>
          <select value={folder} onChange={(e) => { setFolder(e.target.value); mark(); }} className={cls}>
            {allFolders.map((f) => (
              <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1).replace(/-/g, ' ')}</option>
            ))}
          </select>
        </Field>

        {/* Tags */}
        <Field label={t('detailTags')}>
          <div className="flex gap-1.5">
            <input value={tagIn} onChange={(e) => setTagIn(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              placeholder={t('tagPlaceholder')} className={`flex-1 ${cls}`} />
            <button type="button" onClick={addTag}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
              +
            </button>
          </div>
          {tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                  {tag}
                  <button type="button" onClick={() => { setTags((p) => p.filter((x) => x !== tag)); mark(); }}
                    className="text-slate-400 hover:text-red-500">×</button>
                </span>
              ))}
            </div>
          )}
        </Field>

        {/* URL */}
        <Field label={t('detailUrl')}>
          <div className="flex items-center gap-1.5">
            <p className="flex-1 break-all rounded-lg bg-slate-50 px-2.5 py-1.5 text-[10px] text-slate-600 font-mono border border-slate-200">
              {asset.url}
            </p>
          </div>
        </Field>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-3">
        <button type="button" onClick={handleSave} disabled={saving || !dirty}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#0F172A] py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50">
          {saving ? '…' : t('editSave')}
          {dirty && !saving && <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />}
        </button>
        <button type="button" onClick={onCopy} title={copied === asset.url ? t('copied') : t('copyUrl')}
          className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50">
          {copied === asset.url
            ? <Ic d="M20 6L9 17l-5-5" className="h-4 w-4 text-emerald-600" />
            : <Ic d="M8 17.9H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2M10 8h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z" className="h-4 w-4" />}
        </button>
        <button type="button" onClick={onDelete}
          className="rounded-xl border border-red-200 p-2 text-red-500 transition hover:bg-red-50">
          <Ic d="M3 6h18M8 6V4h8v2M19 6v14H5V6" className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}

const cls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-100';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
      {hint && <span className="block text-[10px] text-amber-600">{hint}</span>}
    </label>
  );
}

function MetaRow({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-0.5 text-slate-700 break-all ${className}`}>{children}</p>
    </div>
  );
}
