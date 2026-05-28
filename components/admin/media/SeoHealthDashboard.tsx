'use client';

import { useState } from 'react';

import type { SeoHealthStats } from './types';

const Ic = ({ d, className = 'h-4 w-4' }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d={d} />
  </svg>
);

type Props = {
  stats:     SeoHealthStats;
  folder:    string;
  onFilter(key: string): void;
  onRefresh?(): void;
};

interface AutofixTotals {
  processed:         number;
  aiSuccess:         number;
  aiFailed:          number;
  variantsScheduled: number;
  batches:           number;
  errors:            string[];
  aiConfigured:      boolean;
  remaining:         number;
  done:              boolean;
}

const INITIAL_TOTALS: AutofixTotals = {
  processed: 0, aiSuccess: 0, aiFailed: 0, variantsScheduled: 0,
  batches: 0, errors: [], aiConfigured: true, remaining: 0, done: false,
};

function pct(n: number, total: number) {
  if (!total) return 0;
  return Math.round((n / total) * 100);
}

function ScoreRing({ score }: { score: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash  = circ * (score / 100);
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={72} height={72} viewBox="0 0 72 72" className="shrink-0">
      <circle cx={36} cy={36} r={r} stroke="#e2e8f0" strokeWidth={6} fill="none" />
      <circle cx={36} cy={36} r={r} stroke={color} strokeWidth={6} fill="none"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 36 36)" />
      <text x={36} y={40} textAnchor="middle" fontSize={14} fontWeight={700} fill={color}>
        {score}
      </text>
    </svg>
  );
}

interface IssueRow {
  key:     string;
  label:   string;
  value:   number;
  total:   number;
  icon:    string;
  color:   string;
  filter:  string;
}

export function SeoHealthDashboard({ stats, folder, onFilter, onRefresh }: Props) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<AutofixTotals | null>(null);

  const needsFix = stats.missingAlt + stats.missingKeywords + stats.noWebP + stats.noAvif;

  async function runAutofix() {
    if (running) return;
    const ok = window.confirm(
      `تمام خطاهای سئو توسط AI رفع شود؟\n\nپوشه: ${folder === 'all' ? 'همه فایل‌ها' : folder}\nموارد مشکل‌دار: حدود ${needsFix} مورد\n\nاین کار ممکن است چند دقیقه طول بکشد و اعتبار AI را مصرف می‌کند.`,
    );
    if (!ok) return;

    setRunning(true);
    let totals: AutofixTotals = { ...INITIAL_TOTALS };
    setProgress(totals);

    try {
      for (let i = 0; i < 60; i++) {
        /* First batch handles BOTH meta + variants. Subsequent batches only
         * AI meta — otherwise we keep re-enqueueing the same variant jobs. */
        const scope = i === 0 ? 'all' : 'meta';
        const res = await fetch('/api/media/seo-autofix', {
          method:  'POST',
          headers: { 'content-type': 'application/json' },
          body:    JSON.stringify({ folder, limit: 10, scope }),
        });
        if (!res.ok) {
          totals = { ...totals, done: true, errors: [...totals.errors, `HTTP ${res.status}`] };
          break;
        }
        const data = await res.json() as {
          processed: number; aiSuccess: number; aiFailed: number;
          aiErrors: string[]; variantsScheduled: number; remaining: number;
          aiConfigured: boolean;
        };
        totals = {
          ...totals,
          batches:           totals.batches + 1,
          processed:         totals.processed + data.processed,
          aiSuccess:         totals.aiSuccess + data.aiSuccess,
          aiFailed:          totals.aiFailed  + data.aiFailed,
          variantsScheduled: totals.variantsScheduled + data.variantsScheduled,
          errors:            Array.from(new Set([...totals.errors, ...data.aiErrors])).slice(0, 6),
          aiConfigured:      data.aiConfigured,
          remaining:         data.remaining,
        };
        setProgress({ ...totals });
        /* Stop when nothing left to do (no meta processed, no variants scheduled) */
        if (data.processed === 0 && data.variantsScheduled === 0) break;
        if (data.remaining === 0 && data.variantsScheduled === 0) break;
      }
      /* Drain the variant worker: each call processes a small batch, so we
       * call it a few times with a short delay until it reports zero progress. */
      if (totals.variantsScheduled > 0) {
        for (let k = 0; k < 8; k++) {
          try {
            const wr = await fetch('/api/media/worker', { method: 'POST' });
            if (!wr.ok) break;
            const wj = await wr.json().catch(() => ({} as { processed?: number; pending?: number }));
            if ((wj.processed ?? 0) === 0 && (wj.pending ?? 0) === 0) break;
          } catch { break; }
          await new Promise((r) => setTimeout(r, 800));
        }
      }

      setProgress({ ...totals, done: true });
      onRefresh?.();
    } finally {
      setRunning(false);
    }
  }

  const issues: IssueRow[] = [
    { key: 'alt',      label: 'Missing ALT text',       value: stats.missingAlt,      total: stats.total, icon: 'M17 12H7M12 7l-5 5 5 5', color: 'amber',   filter: 'noAlt=1' },
    { key: 'keywords', label: 'Missing keywords',        value: stats.missingKeywords, total: stats.total, icon: 'M7 20l4-16m2 16l4-16M6 9h14M4 15h14', color: 'orange',  filter: 'noAlt=1' },
    { key: 'webp',     label: 'No WebP variant',         value: stats.noWebP,          total: stats.total, icon: 'M4 16l4-4 4 4 4-8 4 8M3 3h18v14H3z',   color: 'red',     filter: 'noWebP=1' },
    { key: 'avif',     label: 'No AVIF variant',         value: stats.noAvif,          total: stats.total, icon: 'M4 16l4-4 4 4 4-8 4 8M3 3h18v14H3z',   color: 'rose',    filter: 'noAvif=1' },
    { key: 'size',     label: 'Oversized (>200 KB)',     value: stats.oversized,       total: stats.total, icon: 'M12 8v4l3 3M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z', color: 'orange', filter: 'minSize=204800' },
    { key: 'resp',     label: 'No responsive variants',  value: stats.noResponsive,    total: stats.total, icon: 'M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3', color: 'violet', filter: 'processingStatus=done' },
    { key: 'unused',   label: 'Unused assets',           value: stats.unused,          total: stats.total, icon: 'M18.364 5.636L5.636 18.364M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z', color: 'slate', filter: 'unused=1' },
    { key: 'dups',     label: 'Duplicate files',         value: stats.duplicates,      total: stats.total, icon: 'M8 17.9H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2M10 8h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z', color: 'violet', filter: 'duplicates=1' },
    { key: 'low',      label: 'Low score (<60)',          value: stats.lowScore,        total: stats.total, icon: 'M13 16h-1v-4h-1M12 8h.01',              color: 'red',    filter: 'maxScore=59' },
  ];

  const COLOR_BAR: Record<string, string> = {
    amber:  'bg-amber-400',  orange: 'bg-orange-400', red:    'bg-red-400',
    rose:   'bg-rose-400',   violet: 'bg-violet-400', slate:  'bg-slate-400',
  };
  const COLOR_TEXT: Record<string, string> = {
    amber:  'text-amber-700', orange: 'text-orange-700', red:    'text-red-700',
    rose:   'text-rose-700',  violet: 'text-violet-700', slate:  'text-slate-700',
  };

  return (
    <div className="space-y-5 p-3 sm:p-5">
      {/* AI Auto-Fix banner */}
      <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-xl">✨</div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900">رفع خودکار تمام خطاهای سئو با هوش مصنوعی</p>
              <p className="mt-0.5 text-xs text-slate-600">
                AI برای تمام تصاویر فاقد ALT / Title / Caption / Keywords متن تولید و ذخیره می‌کند.
                همچنین ساخت فرمت‌های WebP / AVIF در صف پردازش قرار می‌گیرد.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={runAutofix}
            disabled={running || needsFix === 0}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:from-violet-700 hover:to-fuchsia-700 active:scale-95 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-400"
          >
            {running ? (
              <><span className="animate-spin">⏳</span> در حال اجرا…</>
            ) : needsFix === 0 ? (
              <>✅ همه چیز عالیه</>
            ) : (
              <>✨ شروع رفع خودکار ({needsFix})</>
            )}
          </button>
        </div>

        {/* Progress */}
        {progress && (
          <div className="mt-3 rounded-xl border border-violet-100 bg-white p-3 text-xs">
            {!progress.aiConfigured && (
              <div className="mb-2 rounded-lg bg-amber-50 px-2 py-1.5 text-amber-700">
                ⚠ AI Vision تنظیم نشده — فقط variant‌ها در صف پردازش قرار می‌گیرند.
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <ProgressStat label="AI موفق"  value={progress.aiSuccess}         color="text-emerald-600" />
              <ProgressStat label="AI ناموفق" value={progress.aiFailed}          color="text-rose-600"    />
              <ProgressStat label="Variants"     value={progress.variantsScheduled} color="text-sky-600"     />
              <ProgressStat label="باقیمانده"   value={progress.remaining}         color="text-slate-700"   />
            </div>
            {progress.errors.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-[11px] font-semibold text-rose-600">
                  خطاها ({progress.errors.length})
                </summary>
                <ul className="mt-1 list-disc space-y-0.5 ps-5 text-[11px] text-rose-700">
                  {progress.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </details>
            )}
            {progress.done && (
              <p className="mt-2 text-[11px] font-semibold text-emerald-700">
                ✅ تمام شد. {progress.batches} دسته پردازش شد.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Score summary */}
      <div className="flex items-center gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <ScoreRing score={stats.scoreAvg} />
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-800">Average SEO Score</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {folder !== 'all' ? `Folder: ${folder}` : 'All media'} · {stats.total} assets
          </p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${stats.scoreAvg}%`, backgroundColor: stats.scoreAvg >= 80 ? '#10b981' : stats.scoreAvg >= 60 ? '#f59e0b' : '#ef4444' }} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-right">
          <StatCell label="Low score" value={stats.lowScore} color="red" />
          <StatCell label="Unused"    value={stats.unused}   color="slate" />
          <StatCell label="Duplicates"value={stats.duplicates}color="violet" />
          <StatCell label="No WebP"   value={stats.noWebP}   color="orange" />
        </div>
      </div>

      {/* Issues list */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3">
          <p className="text-sm font-semibold text-slate-800">Issues</p>
        </div>
        <div className="divide-y divide-slate-50">
          {issues.map((row) => (
            <button
              key={row.key}
              type="button"
              onClick={() => onFilter(row.filter)}
              disabled={row.value === 0}
              className="flex w-full items-center gap-4 px-5 py-3 text-start transition hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Ic d={row.icon} className={`h-4 w-4 shrink-0 ${COLOR_TEXT[row.color]}`} />
              <span className="flex-1 text-sm text-slate-700">{row.label}</span>
              <div className="flex items-center gap-3">
                <div className="w-24 overflow-hidden rounded-full bg-slate-100 h-1.5">
                  <div className={`h-full rounded-full ${COLOR_BAR[row.color]}`}
                    style={{ width: `${pct(row.value, row.total)}%` }} />
                </div>
                <span className={`w-8 text-right text-xs font-bold ${row.value > 0 ? COLOR_TEXT[row.color] : 'text-slate-400'}`}>
                  {row.value}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Format coverage */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Have WebP',       value: stats.total - stats.noWebP,  color: 'emerald' },
          { label: 'Have AVIF',       value: stats.total - stats.noAvif,  color: 'emerald' },
          { label: 'Have ALT',        value: stats.total - stats.missingAlt, color: 'emerald' },
          { label: 'Have Keywords',   value: stats.total - stats.missingKeywords, color: 'emerald' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-slate-100 bg-white p-3 text-center shadow-sm">
            <p className={`text-2xl font-bold ${color === 'emerald' ? 'text-emerald-600' : 'text-slate-700'}`}>
              {stats.total > 0 ? pct(value, stats.total) : 0}%
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2.5 py-1.5">
      <p className={`text-base font-bold leading-tight ${color}`}>{value}</p>
      <p className="text-[10px] text-slate-500">{label}</p>
    </div>
  );
}

function StatCell({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = { red: 'text-red-600', slate: 'text-slate-600', violet: 'text-violet-600', orange: 'text-orange-600' };
  return (
    <div>
      <p className={`text-lg font-bold leading-tight ${colors[color] ?? 'text-slate-600'}`}>{value}</p>
      <p className="text-[10px] text-slate-400">{label}</p>
    </div>
  );
}
