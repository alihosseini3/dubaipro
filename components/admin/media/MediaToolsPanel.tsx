'use client';

import { useEffect, useState } from 'react';

/* ─── types ─────────────────────────────────────────────────────────────── */

interface AiStatus {
  enabled:      boolean;
  provider:     string | null;
  model:        string | null;
  baseUrl:      string | null;
  timeoutMs:    number;
  autoGenerate: boolean;
  useWebSearch: boolean;
  hasApiKey:    boolean;
  source:       'database' | 'env' | 'none';
}

interface CleanupPreview {
  orphans:         number;
  staleJobs:       number;
  duplicateGroups: number;
  duplicateAssets: number;
}

/* ─── icon helper ────────────────────────────────────────────────────────── */
const Ic = ({ d, className = 'h-4 w-4' }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d={d} />
  </svg>
);

/* ─── AI Settings card ───────────────────────────────────────────────────── */
const PROVIDERS = [
  { value: 'openai', label: 'OpenAI (GPT-4o / GPT-4V)' },
  { value: 'gemini', label: 'Google Gemini 1.5' },
  { value: 'claude', label: 'Anthropic Claude 3' },
];

const DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-4o-mini',
  gemini: 'gemini-1.5-flash',
  claude: 'claude-3-haiku-20240307',
};

const MODEL_PRESETS: Record<string, { value: string; label: string }[]> = {
  openai: [
    { value: 'gpt-4o-mini', label: 'gpt-4o-mini — سریع و کم‌هزینه (پیشنهادی)' },
    { value: 'gpt-4o', label: 'gpt-4o — کیفیت بالاتر' },
    { value: 'gpt-4.1-mini', label: 'gpt-4.1-mini — نسل جدید mini' },
    { value: 'gpt-4.1', label: 'gpt-4.1 — کیفیت بالاتر' },
  ],
  gemini: [
    { value: 'gemini-2.0-flash', label: 'gemini-2.0-flash — سریع و اقتصادی' },
    { value: 'gemini-1.5-flash', label: 'gemini-1.5-flash — پایدار و سریع' },
    { value: 'gemini-1.5-pro', label: 'gemini-1.5-pro — کیفیت بالاتر' },
  ],
  claude: [
    { value: 'claude-3.5-sonnet-20240620', label: 'claude-3.5-sonnet — کیفیت بالاتر' },
    { value: 'claude-3-haiku-20240307', label: 'claude-3-haiku — سریع و اقتصادی' },
  ],
};

function AiStatusCard() {
  const [status,     setStatus]     = useState<AiStatus | null>(null);
  const [provider,   setProvider]   = useState('');
  const [apiKey,     setApiKey]     = useState('');
  const [model,      setModel]      = useState('');
  const [baseUrl,    setBaseUrl]    = useState('');
  const [timeoutMs,  setTimeoutMs]  = useState(10000);
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [saveMsg,    setSaveMsg]    = useState<string | null>(null);
  const [testing,    setTesting]    = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [dirty,      setDirty]      = useState(false);

  function loadSettings() {
    fetch('/api/admin/media/settings')
      .then((r) => r.ok ? r.json() as Promise<{ ai: AiStatus }> : null)
      .then((d) => {
        if (!d) return;
        setStatus(d.ai);
        const loadedProvider = d.ai.provider ?? '';
        const loadedModel = d.ai.model ?? '';
        setProvider(loadedProvider);
        setModel(loadedModel || DEFAULT_MODELS[loadedProvider] || '');
        setBaseUrl(d.ai.baseUrl ?? '');
        setTimeoutMs(d.ai.timeoutMs ?? 10000);
        setAutoGenerate(d.ai.autoGenerate ?? false);
        setUseWebSearch(d.ai.useWebSearch ?? false);
        setApiKey('');  // never pre-fill key field
      })
      .catch(() => null);
  }

  useEffect(() => { loadSettings(); }, []);

  async function save() {
    setSaving(true);
    setSaveMsg(null);
    try {
      const r = await fetch('/api/admin/media/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aiProvider:  provider || null,
          aiApiKey:    apiKey   || undefined,  // undefined = don't overwrite existing key
          aiModel:     model    || null,
          aiBaseUrl:   baseUrl  || null,
          aiTimeoutMs: timeoutMs,
          aiAutoGenerate: autoGenerate,
          aiUseWebSearch: useWebSearch,
        }),
      });
      if (r.ok) {
        setSaveMsg('✅ ذخیره شد');
        setDirty(false);
        loadSettings();
      } else {
        setSaveMsg('❌ خطا در ذخیره‌سازی');
      }
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 3000);
    }
  }

  async function clearSettings() {
    if (!confirm('تنظیمات AI پاک شود؟')) return;
    await fetch('/api/admin/media/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aiProvider: null, aiApiKey: null, aiModel: null, aiBaseUrl: null, aiAutoGenerate: false, aiUseWebSearch: false }),
    });
    loadSettings();
    setProvider(''); setApiKey(''); setModel(''); setBaseUrl(''); setAutoGenerate(false); setUseWebSearch(false);
    setDirty(false);
  }

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await fetch('/api/admin/media/settings/test-ai', { method: 'POST' });
      const d = await r.json() as { ok: boolean; message: string };
      setTestResult(d.ok ? `✅ ${d.message}` : `❌ ${d.message}`);
    } catch {
      setTestResult('❌ اتصال برقرار نشد');
    } finally {
      setTesting(false);
    }
  }

  const inputCls = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-100';
  const labelCls = 'mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
          <Ic d="M9.663 17h4.673M12 3v1m6.364 1.636-.707.707M21 12h-1M4 12H3m3.343-5.657-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-800">تنظیمات AI Vision</h3>
          <p className="text-[11px] text-slate-400">
            {status === null ? 'در حال بارگذاری…'
              : status.enabled
              ? `فعال — ${status.provider?.toUpperCase()} (منبع: ${status.source === 'database' ? 'پنل' : 'env'})`
              : 'غیرفعال'}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold
          ${status?.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
          {status === null ? '…' : status.enabled ? '● فعال' : '○ غیرفعال'}
        </span>
      </div>

      {/* Form */}
      <div className="space-y-3">
        {/* Provider */}
        <div>
          <label className={labelCls}>Provider</label>
          <select value={provider} onChange={(e) => { setProvider(e.target.value); setModel(DEFAULT_MODELS[e.target.value] ?? ''); setDirty(true); }}
            className={inputCls}>
            <option value="">— غیرفعال —</option>
            {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        {/* API Key */}
        <div>
          <label className={labelCls}>
            API Key
            {status?.hasApiKey && <span className="ms-1 text-emerald-500 normal-case font-normal">(ذخیره شده — برای تغییر جایگزین کنید)</span>}
          </label>
          <input type="password" value={apiKey} onChange={(e) => { setApiKey(e.target.value); setDirty(true); }}
            placeholder={status?.hasApiKey ? '••••••••••••••••' : 'sk-... یا کلید API'}
            className={inputCls} autoComplete="new-password" />
        </div>

        {/* Model */}
        <div>
          <label className={labelCls}>Model <span className="normal-case font-normal text-slate-300">(اختیاری)</span></label>
          <select
            value={model && MODEL_PRESETS[provider]?.some((m) => m.value === model) ? model : ''}
            onChange={(e) => {
              const next = e.target.value;
              if (next) setModel(next);
              setDirty(true);
            }}
            className={inputCls}
            disabled={!provider}
          >
            <option value="">{provider ? 'مدل پیشنهادی را انتخاب کنید' : 'ابتدا Provider انتخاب کنید'}</option>
            {(MODEL_PRESETS[provider] ?? []).map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <input
            type="text"
            value={model}
            onChange={(e) => { setModel(e.target.value); setDirty(true); }}
            placeholder={provider ? `Custom / default: ${DEFAULT_MODELS[provider] ?? 'model-name'}` : 'ابتدا Provider انتخاب کنید'}
            className={`${inputCls} mt-2`}
          />
          <p className="mt-1 text-[10px] text-slate-400">
            اگر مدل را خالی بگذاری، برای OpenAI به‌صورت پیش‌فرض از <strong>gpt-4o-mini</strong> استفاده می‌شود.
          </p>
        </div>

        {/* Base URL */}
        <div>
          <label className={labelCls}>Base URL <span className="normal-case font-normal text-slate-300">(اختیاری — Azure / Ollama)</span></label>
          <input type="text" value={baseUrl} onChange={(e) => { setBaseUrl(e.target.value); setDirty(true); }}
            placeholder="https://your-azure.openai.azure.com"
            className={inputCls} />
        </div>

        {/* Auto Generate Toggle */}
        <div className="mt-2 flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-100">
          <div>
            <p className="text-xs font-semibold text-slate-800">تولید خودکار در زمان آپلود</p>
            <p className="mt-0.5 text-[10px] text-slate-500">مشخصات سئو (Alt، عنوان و کلمات کلیدی) برای عکس‌های جدید خودکار تولید شود</p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={autoGenerate}
              onChange={(e) => { setAutoGenerate(e.target.checked); setDirty(true); }}
            />
            <div className="peer h-5 w-9 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-violet-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none" />
          </label>
        </div>

        {/* Web Search Grounding Toggle */}
        <div className="mt-2 flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-100">
          <div>
            <p className="text-xs font-semibold text-slate-800">جستجوی وب در پس‌زمینه (Google Search Grounding)</p>
            <p className="mt-0.5 text-[10px] text-slate-500">برای تشخیص دقیق‌تر مدل محصول (توصیه می‌شود)، اما پردازش کندتر و گران‌تر می‌شود</p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={useWebSearch}
              onChange={(e) => { setUseWebSearch(e.target.checked); setDirty(true); }}
            />
            <div className="peer h-5 w-9 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-sky-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none" />
          </label>
        </div>

        {/* Timeout */}
        <div>
          <label className={labelCls}>Timeout (ms)</label>
          <input type="number" value={timeoutMs} min={3000} max={60000} step={1000}
            onChange={(e) => { setTimeoutMs(Number(e.target.value)); setDirty(true); }}
            className={inputCls} />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button onClick={save} disabled={saving || !dirty}
            className="flex-1 rounded-xl bg-violet-600 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-40">
            {saving ? 'در حال ذخیره…' : '� ذخیره'}
          </button>
          <button onClick={testConnection} disabled={testing || !status?.enabled}
            className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-40">
            {testing ? '⏳' : '🔌 تست'}
          </button>
          {status?.source === 'database' && (
            <button onClick={clearSettings}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400 hover:text-red-500">
              <Ic d="M3 6h18M8 6V4h8v2M19 6v14H5V6" />
            </button>
          )}
        </div>

        {saveMsg && <p className="text-center text-xs">{saveMsg}</p>}
        {testResult && <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs">{testResult}</p>}
      </div>
    </div>
  );
}

/* ─── Cleanup card ───────────────────────────────────────────────────────── */
function CleanupCard() {
  const [preview, setPreview]   = useState<CleanupPreview | null>(null);
  const [loading, setLoading]   = useState(false);
  const [running, setRunning]   = useState<string | null>(null);
  const [result,  setResult]    = useState<Record<string, number> | null>(null);

  function loadPreview() {
    setLoading(true);
    fetch('/api/admin/media/cleanup')
      .then((r) => r.ok ? r.json() as Promise<{ preview: CleanupPreview }> : null)
      .then((d) => { d && setPreview(d.preview); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => { loadPreview(); }, []);

  async function runCleanup(action: string) {
    setRunning(action);
    setResult(null);
    try {
      const r = await fetch('/api/admin/media/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const d = await r.json() as { results: Record<string, number> };
      setResult(d.results);
      loadPreview();
    } finally {
      setRunning(null);
    }
  }

  const total = preview ? preview.orphans + preview.duplicateAssets + preview.staleJobs : 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
          <Ic d="M3 6h18M8 6V4h8v2M19 6v14H5V6M10 11v6M14 11v6" className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Auto Cleanup</h3>
          <p className="text-[11px] text-slate-400">پاکسازی orphan، duplicate و job های قدیمی</p>
        </div>
        {loading && <div className="ml-auto h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-rose-500" />}
        {!loading && total > 0 && (
          <span className="ml-auto rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-600">{total} مورد</span>
        )}
        {!loading && total === 0 && preview && (
          <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">✓ تمیز</span>
        )}
      </div>

      {preview && (
        <div className="mb-4 space-y-1.5">
          {[
            { key: 'orphans',       label: 'فایل‌های orphan (بدون استفاده >۲۴h)', count: preview.orphans,       action: 'orphans'    },
            { key: 'duplicates',    label: `تصاویر تکراری (${preview.duplicateGroups} گروه)`,    count: preview.duplicateAssets, action: 'duplicates' },
            { key: 'stale_jobs',    label: 'Transform job های قدیمی (>۷ روز)',    count: preview.staleJobs,      action: 'stale_jobs' },
          ].map(({ key, label, count, action }) => (
            <div key={key} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
              <div>
                <p className="text-xs font-medium text-slate-700">{label}</p>
                <p className={`text-[11px] ${count > 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                  {count > 0 ? `${count} مورد قابل پاکسازی` : 'نیازی به پاکسازی نیست'}
                </p>
              </div>
              {count > 0 && (
                <button onClick={() => runCleanup(action)} disabled={!!running}
                  className="rounded-lg bg-rose-500 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-600 disabled:opacity-50">
                  {running === action ? '…' : 'پاکسازی'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {preview && total > 0 && (
        <button onClick={() => runCleanup('all')} disabled={!!running}
          className="w-full rounded-xl bg-rose-500 py-2 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-50">
          {running === 'all' ? '⏳ در حال پاکسازی…' : '🧹 پاکسازی همه'}
        </button>
      )}

      {result && (
        <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700">
          <p className="font-semibold mb-1">✅ انجام شد:</p>
          {Object.entries(result).map(([k, v]) => (
            <p key={k}>{k}: <strong>{v}</strong> مورد</p>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Worker card ────────────────────────────────────────────────────────── */
function WorkerCard() {
  const [queue, setQueue] = useState<{ pending: number; processing: number; failed: number; total: number } | null>(null);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState<{ processed: number; failed: number } | null>(null);

  useEffect(() => {
    fetch('/api/media/worker')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setQueue(d))
      .catch(() => null);
  }, []);

  async function triggerWorker() {
    setRunning(true);
    setDone(null);
    try {
      const r = await fetch('/api/media/worker', { method: 'POST' });
      const d = await r.json() as { processed: number; failed: number };
      setDone(d);
      fetch('/api/media/worker').then((r) => r.ok ? r.json() : null).then((d) => d && setQueue(d));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
          <Ic d="M5 3l14 9-14 9V3z" className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Transform Worker</h3>
          <p className="text-[11px] text-slate-400">صف پردازش تصاویر (AVIF/WebP)</p>
        </div>
      </div>
      {queue && (
        <div className="mb-3 grid grid-cols-3 gap-2 text-center text-xs">
          {[
            { label: 'در صف', val: queue.pending,    color: 'text-amber-600 bg-amber-50' },
            { label: 'در حال اجرا', val: queue.processing, color: 'text-sky-600 bg-sky-50' },
            { label: 'ناموفق', val: queue.failed,    color: 'text-rose-600 bg-rose-50' },
          ].map(({ label, val, color }) => (
            <div key={label} className={`rounded-xl px-2 py-2 ${color}`}>
              <p className="text-lg font-bold">{val}</p>
              <p className="text-[10px]">{label}</p>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <button onClick={triggerWorker} disabled={running}
          className="flex-1 rounded-xl border border-sky-200 bg-sky-50 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-50">
          {running ? '⏳ در حال اجرا…' : '▶ اجرای دستی'}
        </button>
        {(queue?.failed ?? 0) > 0 && (
          <button onClick={async () => {
            if (!confirm('آیا مطمئن هستید که می‌خواهید تمام پردازش‌های ناموفق را دوباره در صف قرار دهید؟')) return;
            await fetch('/api/media/worker', { method: 'POST', body: JSON.stringify({ action: 'retry_failed' }) });
            fetch('/api/media/worker').then((r) => r.ok ? r.json() : null).then((d) => d && setQueue(d));
          }} disabled={running}
            className="flex-1 rounded-xl border border-rose-200 bg-rose-50 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50">
            ↺ تلاش مجدد خطاها
          </button>
        )}
      </div>
      {done && (
        <p className="mt-2 text-center text-[11px] text-emerald-600">✅ {done.processed} پردازش شد، {done.failed} ناموفق</p>
      )}
    </div>
  );
}

/* ─── main panel ─────────────────────────────────────────────────────────── */
export function MediaToolsPanel() {
  return (
    <div className="grid grid-cols-1 gap-4 p-3 sm:p-6 md:grid-cols-2 xl:grid-cols-3">
      <AiStatusCard />
      <CleanupCard />
      <WorkerCard />
    </div>
  );
}
