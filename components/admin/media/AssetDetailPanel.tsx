'use client';

import { SmartImage } from '@/components/ui/SmartImage';
import { useEffect, useRef, useState } from 'react';

import { fmtDate, fmtSize, PRESET_FOLDERS } from './types';
import type { MediaAsset } from './types';

const Ic = ({ d, className = 'h-4 w-4' }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d={d} />
  </svg>
);

interface UsageRow { entityType: string; entityId: string; field: string; }

type Props = {
  asset:         MediaAsset;
  copied:        string | null;
  folderOptions: string[];
  onClose():     void;
  onCopy():      void;
  onDelete():    void;
  onReplace(file: File): Promise<void>;
  onSave(data: Partial<Pick<MediaAsset, 'alt' | 'title' | 'caption' | 'originalName' | 'folder' | 'tags' | 'keywords'>>): Promise<void>;
};

export function AssetDetailPanel({
  asset, copied, folderOptions, onClose, onCopy, onDelete, onReplace, onSave,
}: Props) {
  const [tab,     setTab]     = useState<'info' | 'usage' | 'variants'>('info');
  const [alt,     setAlt]     = useState(asset.alt ?? '');
  const [title,   setTitle]   = useState(asset.title ?? '');
  const [caption, setCaption] = useState(asset.caption ?? '');
  const [fname,   setFname]   = useState(asset.originalName);
  const [folder,  setFolder]  = useState(asset.folder);
  const [tagIn,   setTagIn]   = useState('');
  const [tags,    setTags]    = useState<string[]>(asset.tags ?? []);
  const [keywords, setKeywords] = useState<string[]>(asset.keywords ?? []);
  const [saving,  setSaving]  = useState(false);
  const [dirty,   setDirty]   = useState(false);
  const [usages,  setUsages]  = useState<UsageRow[] | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [replacing,     setReplacing]     = useState(false);
  const [suggestingAlt, setSuggestingAlt] = useState(false);
  const [aiFields,      setAiFields]      = useState<Set<string>>(new Set());
  const [aiProvider,    setAiProvider]    = useState<string | null>(null);
  const [aiConfidence,  setAiConfidence]  = useState<string | null>(null);
  const [aiConfigured,  setAiConfigured]  = useState<boolean | null>(null);
  const [aiError,       setAiError]       = useState<string | null>(null);
  const [autoSaving,    setAutoSaving]    = useState(false);
  const replaceRef = useRef<HTMLInputElement>(null);

  const saveCurrentMeta = async (patch?: { alt?: string; title?: string; caption?: string; keywords?: string[] }) => {
    const payload = {
      alt: alt.trim() || null,
      title: title.trim() || null,
      caption: caption.trim() || null,
      originalName: fname.trim() || asset.originalName,
      folder,
      tags,
      keywords: keywords.length ? keywords : tags,
      ...(patch ?? {}),
    };
    await onSave(payload);
  };

  async function suggestMeta() {
    setSuggestingAlt(true);
    setAiError(null);
    try {
      const r = await fetch(`/api/media/alt-suggest/${asset.id}`);
      if (!r.ok) {
        setAiError(r.status === 429 ? 'Rate limit — please wait a moment' : `Error ${r.status}`);
        return;
      }
      const json = await r.json() as {
        suggestion?: string; title?: string; caption?: string;
        keywords?: string[]; confidence?: string; provider?: string;
        context?: 'ai' | 'rule-based' | 'error';
        aiConfigured?: boolean; error?: string;
      };

      setAiConfigured(json.aiConfigured ?? false);
      const isReal = json.context === 'ai';
      const filled = new Set<string>();

      /* Only fill fields and add badges if AI actually returned data */
      if (isReal) {
        if (json.suggestion) { setAlt(json.suggestion);     filled.add('alt');     mark(); }
        if (json.title)      { setTitle(json.title);         filled.add('title');   mark(); }
        if (json.caption)    { setCaption(json.caption);     filled.add('caption'); mark(); }
        if (json.keywords?.length) {
          const normalizedKeywords = json.keywords.map((k) => k.trim().toLowerCase()).filter(Boolean);
          setKeywords(normalizedKeywords);
          const newTags = normalizedKeywords.filter((k) => !tags.includes(k));
          if (newTags.length) { setTags((p) => [...p, ...newTags]); filled.add('tags'); }
          filled.add('keywords');
          mark();
        }
        setAiProvider(json.provider ?? 'AI');
        setAiConfidence(json.confidence ?? null);

        /* Auto-save immediately so SEO score updates without manual Save Changes */
        setAutoSaving(true);
        try {
          const nextAlt = json.suggestion ?? alt;
          const nextTitle = json.title ?? title;
          const nextCaption = json.caption ?? caption;
          const nextKeywords = json.keywords?.length
            ? json.keywords.map((k) => k.trim().toLowerCase()).filter(Boolean)
            : keywords;

          await saveCurrentMeta({
            alt: nextAlt,
            title: nextTitle,
            caption: nextCaption,
            keywords: nextKeywords,
          });
          setAlt(nextAlt);
          setTitle(nextTitle);
          setCaption(nextCaption);
          setKeywords(nextKeywords);
          setDirty(false);
        } catch (saveErr) {
          setAiError(saveErr instanceof Error ? saveErr.message : 'Failed to auto-save AI metadata');
        } finally {
          setAutoSaving(false);
        }
      } else {
        setAiProvider(null);
        setAiConfidence(null);
        if (json.error) setAiError(json.error);
      }
      setAiFields(filled);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Network error');
    } finally { setSuggestingAlt(false); }
  }

  useEffect(() => {
    setAlt(asset.alt ?? ''); setTitle(asset.title ?? '');
    setCaption(asset.caption ?? ''); setFname(asset.originalName);
    setFolder(asset.folder); setTags(asset.tags ?? []); setKeywords(asset.keywords ?? []);
    setDirty(false); setUsages(null); setAiFields(new Set());
    setAiProvider(null); setAiError(null); setAiConfidence(null);
  }, [asset.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* usage tab lazy-load */
  useEffect(() => {
    if (tab !== 'usage' || usages !== null) return;
    setLoadingUsage(true);
    fetch(`/api/media/usage/${asset.id}`)
      .then((r) => r.json())
      .then((j) => setUsages(j.data ?? []))
      .catch(() => setUsages([]))
      .finally(() => setLoadingUsage(false));
  }, [tab, asset.id, usages]);

  const mark = () => setDirty(true);

  const addTag = () => {
    const t = tagIn.trim().toLowerCase();
    if (t && !tags.includes(t)) { setTags((p) => [...p, t]); mark(); }
    setTagIn('');
  };

  const handleSave = async () => {
    setSaving(true);
    await saveCurrentMeta();
    setSaving(false); setDirty(false);
  };

  const handleReplace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReplacing(true);
    await onReplace(file);
    setReplacing(false);
    e.target.value = '';
  };

  const allFolders = Array.from(new Set([...PRESET_FOLDERS, ...folderOptions]));
  const isVideo    = asset.mimeType.startsWith('video/');
  const score      = asset.optimizationScore;

  const scoreBg = score === null || score === undefined ? 'bg-slate-400'
    : score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <aside className="fixed inset-0 z-50 flex flex-col bg-white shadow-xl overflow-hidden lg:static lg:inset-auto lg:z-auto lg:w-80 lg:shrink-0 lg:border-s lg:border-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">Asset Details</p>
        <button type="button" onClick={onClose}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <Ic d="M18 6L6 18M6 6l12 12" />
        </button>
      </div>

      {/* Preview */}
      <div className="relative h-44 shrink-0 overflow-hidden bg-slate-900">
        {isVideo ? (
          <video src={asset.url} muted preload="metadata" className="h-full w-full object-contain" />
        ) : (
          <SmartImage
            src={asset.url}
            alt={asset.alt || asset.originalName}
            thumbnailUrl={asset.thumbnailUrl || undefined}
            sizes="320px"
            className="absolute inset-0 h-full w-full object-contain"
            style={asset.dominantColor ? { backgroundColor: asset.dominantColor } : undefined}
          />
        )}
        {score !== null && score !== undefined && (
          <span className={`absolute bottom-2 end-2 rounded-lg px-2 py-0.5 text-[11px] font-bold backdrop-blur-sm ${scoreBg}/80 text-white`}>
            SEO: {score}
          </span>
        )}
        {asset.processingStatus && asset.processingStatus !== 'done' && (
          <span className={`absolute bottom-2 start-2 rounded-lg px-2 py-0.5 text-[11px] font-bold backdrop-blur-sm
            ${asset.processingStatus === 'failed' ? 'bg-red-500/80' : 'bg-blue-500/80'} text-white`}>
            {asset.processingStatus}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100">
        {(['info', 'usage', 'variants'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`flex-1 py-2 text-[11px] font-semibold uppercase tracking-wide transition
              ${tab === t ? 'border-b-2 border-orange-500 text-orange-600' : 'text-slate-400 hover:text-slate-700'}`}>
            {t === 'info' ? 'Info' : t === 'usage' ? `Usage${usages ? ` (${usages.length})` : ''}` : 'Variants'}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {/* INFO TAB */}
        {tab === 'info' && (
          <div className="px-4 py-4 space-y-4">
            {/* File info */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 rounded-xl bg-slate-50 px-3 py-3 text-[11px]">
              <MetaRow label="Type">{asset.mimeType}</MetaRow>
              <MetaRow label="Size">{fmtSize(asset.size)}</MetaRow>
              {asset.width && asset.height && (
                <MetaRow label="Dimensions">{asset.width}×{asset.height}</MetaRow>
              )}
              <MetaRow label="Folder" className="capitalize">{asset.folder}</MetaRow>
              <MetaRow label="Uploaded">{fmtDate(asset.createdAt)}</MetaRow>
              {asset.uploadedBy && <MetaRow label="By">{asset.uploadedBy.name}</MetaRow>}
              {asset.storageProvider && <MetaRow label="Storage">{asset.storageProvider}</MetaRow>}
              {asset._count?.usages !== undefined && (
                <MetaRow label="References">{asset._count.usages}</MetaRow>
              )}
            </div>

            {/* SEO score breakdown */}
            {score !== null && score !== undefined && (
              <div className="rounded-xl bg-slate-50 px-3 py-3">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">SEO Score</p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className={`h-full rounded-full ${scoreBg}`} style={{ width: `${score}%` }} />
                </div>
                <p className={`mt-1 text-right text-xs font-bold ${score >= 80 ? 'text-emerald-600' : score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                  {score}/100
                </p>
              </div>
            )}

            {/* Editable fields */}
            <Field label="Filename">
              <input value={fname} onChange={(e) => { setFname(e.target.value); mark(); }}
                className={cls} maxLength={255} />
            </Field>
            {/* AI Suggest button */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={suggestMeta}
                disabled={suggestingAlt || autoSaving}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-50 transition"
              >
                {suggestingAlt || autoSaving
                  ? <><span className="animate-spin">⏳</span> AI در حال تحلیل…</>
                  : <>✨ AI Auto-fill  <span className="font-normal opacity-60">(alt · title · caption · keywords)</span></>}
              </button>
            </div>
            {aiProvider && (
              <div className="flex items-center gap-1.5 rounded-lg bg-violet-50 px-2.5 py-1.5 text-[11px] text-violet-700">
                <span>✅ توسط <strong>{aiProvider}</strong> پر شد</span>
                {aiConfidence && <span className="ml-auto opacity-60">confidence: {aiConfidence}</span>}
              </div>
            )}
            {aiConfigured === false && !suggestingAlt && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-800">
                <p className="font-bold mb-0.5">⚠ AI تنظیم نشده</p>
                <p>در حال حاضر فقط از اسم فایل استفاده میشود. برای تحلیل واقعی تصویر:</p>
                <p className="mt-1">» به <strong>🛠 Tools</strong> بروید و Provider + API Key را تنظیم کنید.</p>
              </div>
            )}
            {aiError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[11px] text-rose-700">
                <p className="font-bold mb-0.5">❌ خطا</p>
                <p>{aiError}</p>
              </div>
            )}
            {autoSaving && (
              <div className="rounded-lg border border-sky-200 bg-sky-50 p-2.5 text-[11px] text-sky-700">
                <p className="font-bold mb-0.5">💾 ذخیره خودکار</p>
                <p>محتوای AI در حال ثبت در دیتابیس است…</p>
              </div>
            )}

            {keywords.length > 0 && (
              <div className="rounded-lg bg-violet-50 px-2.5 py-2 text-[11px] text-violet-700">
                <p className="mb-1 font-semibold uppercase tracking-wider text-violet-500">AI Keywords</p>
                <div className="flex flex-wrap gap-1">
                  {keywords.slice(0, 12).map((k) => (
                    <span key={k} className="rounded-full bg-white px-2 py-0.5 text-[10px] text-violet-700 ring-1 ring-violet-200">{k}</span>
                  ))}
                </div>
              </div>
            )}

            {/* ALT */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  ALT text {!alt && <span className="text-amber-500">⚠</span>}
                  {aiFields.has('alt') && <span className="ms-1 rounded bg-violet-100 px-1 py-0.5 text-[9px] text-violet-600">AI</span>}
                </span>
              </div>
              <input value={alt} onChange={(e) => { setAlt(e.target.value); mark(); }}
                className={`${cls} ${!alt ? 'border-amber-300 bg-amber-50 focus:border-amber-400 focus:ring-amber-100' : aiFields.has('alt') ? 'border-violet-200 bg-violet-50' : ''}`}
                placeholder="Describe the image…" maxLength={255} />
              {!alt && <p className="mt-0.5 text-[10px] text-amber-600">Missing — affects SEO score</p>}
            </div>
            <div>
              <div className="mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Title
                  {aiFields.has('title') && <span className="ms-1 rounded bg-violet-100 px-1 py-0.5 text-[9px] text-violet-600">AI</span>}
                </span>
              </div>
              <input value={title} onChange={(e) => { setTitle(e.target.value); mark(); }}
                className={`${cls} ${aiFields.has('title') ? 'border-violet-200 bg-violet-50' : ''}`} maxLength={255} />
            </div>
            <div>
              <div className="mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Caption
                  {aiFields.has('caption') && <span className="ms-1 rounded bg-violet-100 px-1 py-0.5 text-[9px] text-violet-600">AI</span>}
                </span>
              </div>
              <textarea value={caption} onChange={(e) => { setCaption(e.target.value); mark(); }}
                rows={2} className={`${cls} ${aiFields.has('caption') ? 'border-violet-200 bg-violet-50' : ''}`} maxLength={500} />
            </div>
            <Field label="Folder">
              <select value={folder} onChange={(e) => { setFolder(e.target.value); mark(); }} className={cls}>
                {allFolders.map((f) => (
                  <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1).replace(/-/g, ' ')}</option>
                ))}
              </select>
            </Field>
            <Field label="Tags">
              <div className="flex gap-1.5">
                <input value={tagIn} onChange={(e) => setTagIn(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  placeholder="Add tag…" className={`flex-1 ${cls}`} />
                <button type="button" onClick={addTag}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50">+</button>
              </div>
              <p className="mt-1 text-[10px] text-slate-400">Tags برای مدیریت داخلی‌اند؛ keywords برای SEO و امتیاز استفاده می‌شوند.</p>
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
            <Field label="URL">
              <p className="break-all rounded-lg bg-slate-50 px-2.5 py-1.5 text-[10px] text-slate-600 font-mono border border-slate-200">
                {asset.url}
              </p>
            </Field>
          </div>
        )}

        {/* USAGE TAB */}
        {tab === 'usage' && (
          <div className="px-4 py-4">
            {loadingUsage && (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            )}
            {!loadingUsage && usages?.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Ic d="M18.364 5.636L5.636 18.364M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" className="h-10 w-10 text-slate-300" />
                <p className="text-sm font-semibold text-slate-600">Not used anywhere</p>
                <p className="text-xs text-slate-400">This asset has no references in any entity.</p>
              </div>
            )}
            {!loadingUsage && usages && usages.length > 0 && (
              <div className="space-y-1.5">
                {usages.map((u, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                    <Ic d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-700 capitalize">
                        {u.entityType.replace(/_/g, ' ')}
                      </p>
                      <p className="truncate text-[10px] text-slate-400">{u.field} · {u.entityId.slice(0, 12)}…</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VARIANTS TAB */}
        {tab === 'variants' && (
          <div className="px-4 py-4 space-y-2">
            {(!asset.variants || asset.variants.length === 0) ? (
              <p className="text-sm text-slate-400 py-8 text-center">No variants</p>
            ) : (
              asset.variants.map((v, i) => (
                <div key={i} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase text-slate-500">{v.preset}/{v.format}</span>
                    <span className="text-[10px] text-slate-400">{fmtSize(v.size)}</span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-slate-400">{v.width}×{v.height}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-100 px-4 py-3 space-y-2">
        {tab === 'info' && (
          <button type="button" onClick={handleSave} disabled={saving || !dirty}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0F172A] py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50">
            {saving ? '…' : 'Save Changes'}
            {dirty && !saving && <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />}
          </button>
        )}
        <div className="flex items-center gap-2">
          {/* Replace */}
          <button type="button" onClick={() => replaceRef.current?.click()}
            disabled={replacing}
            title="Replace file (keeps URL)"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            <Ic d="M4 16v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1M12 12V4m0 0-3 3m3-3 3 3" className="h-3.5 w-3.5" />
            {replacing ? 'Replacing…' : 'Replace'}
          </button>
          <input ref={replaceRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleReplace} />
          {/* Copy URL */}
          <button type="button" onClick={onCopy} title={copied === asset.url ? 'Copied!' : 'Copy URL'}
            className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50">
            {copied === asset.url
              ? <Ic d="M20 6L9 17l-5-5" className="h-4 w-4 text-emerald-600" />
              : <Ic d="M8 17.9H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2M10 8h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z" className="h-4 w-4" />}
          </button>
          {/* Delete */}
          <button type="button" onClick={onDelete}
            className="rounded-xl border border-red-200 p-2 text-red-500 hover:bg-red-50">
            <Ic d="M3 6h18M8 6V4h8v2M19 6v14H5V6" className="h-4 w-4" />
          </button>
        </div>
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
