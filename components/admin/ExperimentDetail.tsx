'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

type Stat = {
  variantId: string;
  variantKey: string;
  variantName: string;
  weight: number;
  config: unknown;
  visitors: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  cvr: number;
  ctr: number;
  aov: number;
  rpu: number;
};
type Verdict = {
  winnerId: string | null;
  baselineId: string | null;
  liftPct: number;
  zScore: number;
  confidence: number;
  confidenceLevel: 'insufficient' | 'low' | 'medium' | 'high';
  shouldApply: boolean;
  minVisitors: number;
};
type Detail = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isActive: boolean;
  stats: Stat[];
  verdict: Verdict;
  minSampleSize: number;
};

export function ExperimentDetail({ id, locale }: { id: string; locale: string }) {
  const t = useTranslations('admin.experiments');
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
    // refresh every 30s so the "live results" feel is real but cheap
    const id = setInterval(() => void load(), 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    try {
      const res = await fetch(`/api/admin/experiments/${id}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json = (await res.json()) as { data: Detail };
      setData(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive() {
    if (!data) return;
    try {
      const res = await fetch(`/api/admin/experiments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !data.isActive })
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    }
  }

  async function applyWinner() {
    if (!data?.verdict.shouldApply) return;
    if (!confirm(t('applyConfirm'))) return;
    try {
      const res = await fetch(`/api/admin/experiments/${id}/apply-winner`, {
        method: 'POST'
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `status ${res.status}`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    }
  }

  function fmtMoney(n: number) {
    return n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  if (loading && !data) {
    return <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">{t('loading')}</div>;
  }
  if (!data) {
    return <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>;
  }

  const totalVisitors = data.stats.reduce((a, s) => a + s.visitors, 0);
  const winner = data.stats.find((s) => s.variantId === data.verdict.winnerId);
  const baseline = data.stats.find((s) => s.variantId === data.verdict.baselineId);
  const challenger =
    data.stats.length >= 2
      ? data.stats
          .filter((s) => s.variantId !== data.verdict.baselineId)
          .reduce((best, cur) => (cur.rpu > best.rpu ? cur : best))
      : null;
  const maxRevenue = Math.max(1, ...data.stats.map((s) => s.revenue));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link href={`/${locale}/admin/experiments`} className="text-xs text-slate-500 hover:underline">
              ← {t('backToList')}
            </Link>
          </div>
          <h2 className="text-lg font-semibold text-slate-900">{data.name}</h2>
          <p className="font-mono text-xs text-slate-500">{data.key}</p>
          {data.description && <p className="text-sm text-slate-600">{data.description}</p>}
        </div>
        <button
          type="button"
          onClick={toggleActive}
          className={
            'rounded-full px-3 py-1 text-xs font-medium ' +
            (data.isActive
              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200')
          }
        >
          {data.isActive ? t('active') : t('paused')}
        </button>
      </div>

      <VerdictBanner
        verdict={data.verdict}
        winner={winner ?? null}
        baseline={baseline ?? null}
        challenger={challenger}
        minSample={data.minSampleSize}
        onApply={applyWinner}
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <RevenueChart stats={data.stats} maxRevenue={maxRevenue} winnerId={data.verdict.winnerId} />
        <Funnel stats={data.stats} />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data.stats.map((s) => {
          const share =
            totalVisitors > 0 ? (s.visitors / totalVisitors) * 100 : 0;
          const isWinner = s.variantId === data.verdict.winnerId;
          return (
            <div
              key={s.variantId}
              className={
                'rounded-xl border bg-white p-4 ' +
                (isWinner ? 'border-emerald-300 ring-1 ring-emerald-200' : 'border-slate-200')
              }
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">
                  {s.variantName}{' '}
                  <span className="font-mono text-xs text-slate-500">({s.variantKey})</span>
                </p>
                {isWinner && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                    {t('winnerBadge')}
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                {t('weight')}: {s.weight} · {share.toFixed(1)}% {t('shareOfTraffic')}
              </p>

              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-slate-500">{t('visitors')}</dt>
                  <dd className="font-semibold tabular-nums text-slate-900">
                    {s.visitors.toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t('impressions')}</dt>
                  <dd className="font-semibold tabular-nums text-slate-900">
                    {s.impressions.toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t('clicks')}</dt>
                  <dd className="font-semibold tabular-nums text-slate-900">
                    {s.clicks.toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t('conversions')}</dt>
                  <dd className="font-semibold tabular-nums text-slate-900">
                    {s.conversions.toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t('cvr')}</dt>
                  <dd className="font-semibold tabular-nums text-slate-900">
                    {(s.cvr * 100).toFixed(2)}%
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t('aov')}</dt>
                  <dd className="font-semibold tabular-nums text-slate-900">
                    {fmtMoney(s.aov)}
                  </dd>
                </div>
                <div className="col-span-2 rounded-md bg-emerald-50/60 p-2">
                  <dt className="text-[10px] uppercase tracking-wide text-emerald-700">
                    {t('rpu')}
                  </dt>
                  <dd className="text-base font-bold tabular-nums text-emerald-900">
                    {fmtMoney(s.rpu)}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-slate-500">{t('revenue')}</dt>
                  <dd className="font-semibold tabular-nums text-slate-900">
                    {fmtMoney(s.revenue)}
                  </dd>
                </div>
              </dl>

              <details className="mt-3">
                <summary className="cursor-pointer text-[11px] text-slate-500 hover:text-slate-900">
                  {t('configLabel')}
                </summary>
                <pre className="mt-1 max-h-32 overflow-auto rounded bg-slate-50 p-2 text-[11px] text-slate-700">
                  {JSON.stringify(s.config, null, 2)}
                </pre>
              </details>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}

/**
 * The headline banner that summarises the verdict in plain English.
 *
 * States we render distinctly:
 *   - `shouldApply` true  → green call-to-action with "Apply winner"
 *   - confidence: low/med → amber "still gathering data"
 *   - insufficient        → grey "need at least N visitors"
 *   - lift negative       → no winner yet (best challenger underperforms)
 */
function VerdictBanner({
  verdict,
  winner,
  baseline,
  challenger,
  minSample,
  onApply
}: {
  verdict: Verdict;
  winner: Stat | null;
  baseline: Stat | null;
  challenger: Stat | null;
  minSample: number;
  onApply: () => void;
}) {
  const t = useTranslations('admin.experiments');
  const liftPctAbs = Math.abs(verdict.liftPct * 100);
  const confPct = (verdict.confidence * 100).toFixed(1);

  // Insight copy reuses the comparison even when we can't apply yet,
  // because operators want to see the direction of travel early.
  const insight =
    challenger && baseline && challenger.variantId !== baseline.variantId
      ? verdict.liftPct >= 0
        ? t('insightLift', {
            challenger: `${challenger.variantName} (${challenger.variantKey})`,
            baseline: `${baseline.variantName} (${baseline.variantKey})`,
            pct: liftPctAbs.toFixed(1)
          })
        : t('insightDrop', {
            challenger: `${challenger.variantName} (${challenger.variantKey})`,
            baseline: `${baseline.variantName} (${baseline.variantKey})`,
            pct: liftPctAbs.toFixed(1)
          })
      : null;

  if (verdict.shouldApply && winner) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
            {t('winnerLabel')} · {t(`confidence.high`)} ({confPct}%)
          </p>
          <p className="text-lg font-semibold text-emerald-900">
            {winner.variantName} ({winner.variantKey})
          </p>
          {insight && <p className="text-sm text-emerald-800">{insight}</p>}
        </div>
        <button
          type="button"
          onClick={onApply}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
        >
          {t('applyWinner')}
        </button>
      </div>
    );
  }

  if (verdict.confidenceLevel === 'insufficient') {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <p className="font-medium text-slate-700">{t('gatheringData')}</p>
        <p className="mt-1 text-xs text-slate-500">
          {t('notEnoughData', { min: minSample })}
          {' · '}
          {t('currentMinVisitors', { count: verdict.minVisitors })}
        </p>
        {insight && <p className="mt-2 text-xs text-slate-600">{insight}</p>}
      </div>
    );
  }

  // Low / medium confidence: directional but not decisive.
  const tone =
    verdict.confidenceLevel === 'medium'
      ? 'border-amber-300 bg-amber-50 text-amber-900'
      : 'border-slate-200 bg-slate-50 text-slate-700';
  return (
    <div className={`rounded-xl border p-4 text-sm ${tone}`}>
      <p className="font-medium">
        {t(`confidence.${verdict.confidenceLevel}`)} ({confPct}%)
      </p>
      {insight && <p className="mt-1 text-xs">{insight}</p>}
      <p className="mt-1 text-[11px] opacity-80">{t('keepRunning')}</p>
    </div>
  );
}

/**
 * Horizontal bar chart of revenue per variant.
 * Pure SVG, ~30 LOC, zero deps.
 */
function RevenueChart({
  stats,
  maxRevenue,
  winnerId
}: {
  stats: Stat[];
  maxRevenue: number;
  winnerId: string | null;
}) {
  const t = useTranslations('admin.experiments');
  const rowH = 36;
  const padX = 110;
  const w = 520;
  const h = stats.length * rowH + 24;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="mb-3 text-sm font-semibold text-slate-900">
        {t('chartRevenue')}
      </p>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img">
        {stats.map((s, i) => {
          const y = i * rowH + 12;
          const barW = ((s.revenue / maxRevenue) * (w - padX - 16)) || 0;
          const isWinner = s.variantId === winnerId;
          return (
            <g key={s.variantId}>
              <text
                x={padX - 8}
                y={y + 14}
                textAnchor="end"
                className="fill-slate-700 text-xs font-medium"
              >
                {s.variantName} ({s.variantKey})
              </text>
              <rect
                x={padX}
                y={y}
                width={Math.max(barW, 2)}
                height={20}
                rx={4}
                className={isWinner ? 'fill-emerald-500' : 'fill-slate-400'}
              />
              <text
                x={padX + barW + 6}
                y={y + 14}
                className="fill-slate-700 text-[11px] tabular-nums"
              >
                {s.revenue.toLocaleString(undefined, {
                  maximumFractionDigits: 0
                })}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * Conversion funnel: impressions → clicks → conversions per variant.
 * One stacked row per variant; bar widths normalised to the variant's
 * own impression count so shapes are comparable across arms.
 */
function Funnel({ stats }: { stats: Stat[] }) {
  const t = useTranslations('admin.experiments');
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="mb-3 text-sm font-semibold text-slate-900">
        {t('chartFunnel')}
      </p>
      <div className="space-y-3">
        {stats.map((s) => {
          const imp = Math.max(1, s.impressions);
          const clickPct = (s.clicks / imp) * 100;
          const convPct = (s.conversions / imp) * 100;
          return (
            <div key={s.variantId}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700">
                  {s.variantName} ({s.variantKey})
                </span>
                <span className="tabular-nums text-slate-500">
                  {s.impressions.toLocaleString()} → {s.clicks.toLocaleString()} →{' '}
                  {s.conversions.toLocaleString()}
                </span>
              </div>
              <div className="relative h-5 overflow-hidden rounded bg-slate-100">
                <div
                  className="absolute inset-y-0 left-0 bg-slate-300"
                  style={{ width: '100%' }}
                />
                <div
                  className="absolute inset-y-0 left-0 bg-sky-400"
                  style={{ width: `${Math.min(clickPct, 100)}%` }}
                />
                <div
                  className="absolute inset-y-0 left-0 bg-emerald-500"
                  style={{ width: `${Math.min(convPct, 100)}%` }}
                />
              </div>
              <div className="mt-1 flex gap-3 text-[10px] text-slate-500">
                <span>
                  <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-slate-300 align-middle" />
                  {t('impressions')}
                </span>
                <span>
                  <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-sky-400 align-middle" />
                  {t('clicks')} {clickPct.toFixed(1)}%
                </span>
                <span>
                  <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-emerald-500 align-middle" />
                  {t('conversions')} {convPct.toFixed(2)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
