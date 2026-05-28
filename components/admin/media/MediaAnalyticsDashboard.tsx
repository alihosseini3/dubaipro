'use client';

import { useEffect, useState } from 'react';

/* ─── types ─────────────────────────────────────────────────────────────── */

interface AnalyticsData {
  generatedAt: string;
  overview: {
    totalAssets:             number;
    totalVariants:           number;
    totalSizeBytes:          number;
    estimatedOriginalBytes:  number;
    bytesSaved:              number;
    bytesSavedPct:           number;
    avgCompressionRatio:     number;
    withOriginalUrl:         number;
  };
  coverage: {
    webp:     { count: number; pct: number };
    avif:     { count: number; pct: number };
    alt:      { count: number; pct: number };
    keywords: { count: number; pct: number };
    seoTitle: { count: number; pct: number };
    seoScore: number;
  };
  scoreDistribution: {
    excellent: number; good: number; poor: number; critical: number; unscored: number;
    avg: number; min: number; max: number;
  };
  queue: {
    byStatus:     Record<string, number>;
    byAction:     { action: string; count: number }[];
    recentFailed: { id: string; assetId: string; action: string; error: string | null; attempts: number; doneAt: string | null }[];
  };
  trends: {
    dailyUploads: { day: string; count: number }[];
  };
  topHeavyAssets: {
    id: string; originalName: string; size: number; mimeType: string;
    folder: string; optimizationScore: number | null; url: string; thumbnailUrl: string | null;
  }[];
  mimeTypes: { mimeType: string; count: number }[];
}

/* ─── helpers ────────────────────────────────────────────────────────────── */

function fmtBytes(b: number): string {
  if (b >= 1_073_741_824) return `${(b / 1_073_741_824).toFixed(2)} GB`;
  if (b >= 1_048_576)     return `${(b / 1_048_576).toFixed(1)} MB`;
  if (b >= 1_024)         return `${(b / 1_024).toFixed(0)} KB`;
  return `${b} B`;
}

const Ic = ({ d, className = 'h-4 w-4' }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d={d} />
  </svg>
);

/* ─── sub-components ─────────────────────────────────────────────────────── */

function CoverageRing({ label, pct, color }: { label: string; pct: number; color: string }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const fill = (pct / 100) * circ;
  const scoreColor = pct >= 80 ? 'text-emerald-600' : pct >= 60 ? 'text-amber-500' : 'text-red-500';
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="72" height="72" className="-rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" stroke="#e5e7eb" strokeWidth="6" />
        <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={circ} strokeDashoffset={circ - fill}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      </svg>
      <div className="text-center">
        <p className={`text-lg font-bold ${scoreColor}`}>{pct}%</p>
        <p className="text-[11px] text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
        <Ic d={icon} className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-xl font-bold text-slate-900 leading-none mt-0.5">{value}</p>
        {sub && <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}

function MiniBar({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs">
        <span className="text-slate-600 capitalize">{label}</span>
        <span className="font-semibold text-slate-800">{count}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%`, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  );
}

function UploadSparkline({ data }: { data: { day: string; count: number }[] }) {
  if (data.length === 0) return <p className="text-xs text-slate-400">No upload data for last 30 days.</p>;
  const max = Math.max(...data.map((d) => d.count), 1);
  const W = 480; const H = 60; const pad = 2;
  const step = (W - pad * 2) / Math.max(data.length - 1, 1);
  const pts = data.map((d, i) => {
    const x = pad + i * step;
    const y = H - pad - ((d.count / max) * (H - pad * 2));
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ─── main component ─────────────────────────────────────────────────────── */

export function MediaAnalyticsDashboard() {
  const [data,    setData]    = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch('/api/admin/media/analytics')
      .then((r) => r.ok ? r.json() as Promise<AnalyticsData> : Promise.reject(r.status))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError('Failed to load analytics'); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Ic d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" className="h-6 w-6 animate-spin" />
        <span className="ml-2 text-sm">Loading analytics…</span>
      </div>
    );
  }
  if (error || !data) {
    return <p className="text-sm text-red-600 p-6">{error}</p>;
  }

  const { overview, coverage, scoreDistribution: sd, queue, trends, topHeavyAssets } = data;

  const qTotal = Object.values(queue.byStatus).reduce((s, c) => s + c, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Media Analytics</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Updated {new Date(data.generatedAt).toLocaleString()}
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); fetch('/api/admin/media/analytics').then((r) => r.json() as Promise<AnalyticsData>).then((d) => { setData(d); setLoading(false); }).catch(() => setLoading(false)); }}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <Ic d="M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15" />
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Assets"   value={overview.totalAssets.toLocaleString()}   icon="M4 6h16M4 10h16M4 14h16M4 18h16" />
        <StatCard label="Variants"       value={overview.totalVariants.toLocaleString()} icon="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
        <StatCard label="Storage Used"   value={fmtBytes(overview.totalSizeBytes)}       icon="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <StatCard
          label="Bandwidth Saved"
          value={fmtBytes(overview.bytesSaved)}
          sub={`${overview.bytesSavedPct}% vs uncompressed`}
          icon="M22 12H2M15 19l7-7-7-7"
        />
      </div>

      {/* Coverage rings */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-5 text-sm font-semibold text-slate-700">Format & SEO Coverage</h3>
        <div className="flex flex-wrap justify-around gap-6">
          <CoverageRing label="WebP"     pct={coverage.webp.pct}     color="#6366f1" />
          <CoverageRing label="AVIF"     pct={coverage.avif.pct}     color="#8b5cf6" />
          <CoverageRing label="ALT Text" pct={coverage.alt.pct}      color="#10b981" />
          <CoverageRing label="Keywords" pct={coverage.keywords.pct} color="#f59e0b" />
          <CoverageRing label="SEO Title"pct={coverage.seoTitle.pct} color="#3b82f6" />
        </div>
        <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-center">
          <p className="text-xs text-slate-500">Overall SEO Completion Score</p>
          <p className={`text-3xl font-black ${coverage.seoScore >= 80 ? 'text-emerald-600' : coverage.seoScore >= 60 ? 'text-amber-500' : 'text-red-500'}`}>
            {coverage.seoScore}<span className="text-base font-semibold text-slate-400">/100</span>
          </p>
        </div>
      </section>

      {/* Score distribution + Queue health */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Score distribution */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Optimization Score Distribution</h3>
          <div className="space-y-2.5">
            <MiniBar label={`Excellent (80-100) — ${sd.excellent}`} count={sd.excellent} max={overview.totalAssets} color="bg-emerald-500" />
            <MiniBar label={`Good (60-79) — ${sd.good}`}            count={sd.good}      max={overview.totalAssets} color="bg-sky-500"     />
            <MiniBar label={`Poor (40-59) — ${sd.poor}`}            count={sd.poor}      max={overview.totalAssets} color="bg-amber-400"   />
            <MiniBar label={`Critical (<40) — ${sd.critical}`}      count={sd.critical}  max={overview.totalAssets} color="bg-red-500"     />
            <MiniBar label={`Unscored — ${sd.unscored}`}            count={sd.unscored}  max={overview.totalAssets} color="bg-slate-300"   />
          </div>
          <p className="mt-3 text-center text-xs text-slate-400">
            Avg score: <span className={`font-bold ${sd.avg >= 80 ? 'text-emerald-600' : sd.avg >= 60 ? 'text-amber-500' : 'text-red-500'}`}>{sd.avg}/100</span>
          </p>
        </section>

        {/* Queue health */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Transform Queue</h3>
          {qTotal === 0 ? (
            <p className="text-sm text-slate-400">No transform jobs found.</p>
          ) : (
            <div className="space-y-2.5">
              {Object.entries(queue.byStatus).map(([status, count]) => (
                <MiniBar key={status}
                  label={`${status} — ${count}`}
                  count={count} max={qTotal}
                  color={status === 'done' ? 'bg-emerald-400' : status === 'failed' ? 'bg-red-500' : status === 'processing' ? 'bg-sky-500' : 'bg-slate-300'}
                />
              ))}
            </div>
          )}
          {queue.recentFailed.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-red-500">Recent Failures</p>
              <ul className="space-y-1">
                {queue.recentFailed.map((j) => (
                  <li key={j.id} className="rounded-lg bg-red-50 px-3 py-1.5">
                    <p className="text-[11px] font-medium text-red-700">{j.action} — {j.attempts} attempts</p>
                    <p className="truncate text-[10px] text-red-400">{j.error ?? 'unknown error'}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      {/* Upload trend sparkline */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Upload Trend — Last 30 Days</h3>
        <UploadSparkline data={trends.dailyUploads} />
        {trends.dailyUploads.length > 0 && (
          <div className="mt-2 flex justify-between text-[10px] text-slate-400">
            <span>{trends.dailyUploads[0]?.day}</span>
            <span>Total: {trends.dailyUploads.reduce((s, d) => s + d.count, 0)} uploads</span>
            <span>{trends.dailyUploads[trends.dailyUploads.length - 1]?.day}</span>
          </div>
        )}
      </section>

      {/* Top heavy assets */}
      {topHeavyAssets.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-3">
            <h3 className="text-sm font-semibold text-slate-700">Top Heavy Assets</h3>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-slate-50">
              <tr>
                {['File', 'Size', 'Folder', 'Score', ''].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topHeavyAssets.map((a) => (
                <tr key={a.id} className="border-t border-slate-50 hover:bg-slate-50">
                  <td className="max-w-[180px] truncate px-4 py-2.5 font-medium text-slate-700">{a.originalName}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-500">{fmtBytes(a.size)}</td>
                  <td className="px-4 py-2.5 capitalize text-slate-400">{a.folder}</td>
                  <td className="px-4 py-2.5">
                    {a.optimizationScore !== null ? (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold
                        ${(a.optimizationScore ?? 0) >= 80 ? 'bg-emerald-100 text-emerald-700' : (a.optimizationScore ?? 0) >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                        {a.optimizationScore}
                      </span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <a href={a.url} target="_blank" rel="noopener noreferrer"
                      className="text-indigo-500 hover:underline">View</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
