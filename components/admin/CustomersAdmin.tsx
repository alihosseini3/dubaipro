'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

type Segment = 'NEW' | 'REPEAT' | 'HIGH_VALUE' | 'INACTIVE';

type Row = {
  userId: string;
  totalSpent: number;
  lifetimeValue: number;
  orderCount: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  segment: Segment;
  user: { name: string; email: string; createdAt: string };
};

type Kpis = {
  totalRevenue: number;
  avgLtv: number;
  customerCount: number;
  repeatRate: number;
  segments: Record<Segment, number>;
};

export function CustomersAdmin() {
  const t = useTranslations('admin.customers');
  const [rows, setRows] = useState<Row[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [segment, setSegment] = useState<Segment | ''>('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, segment]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (segment) params.set('segment', segment);
      if (q) params.set('q', q);
      params.set('page', String(page));
      const res = await fetch(`/api/admin/customers?${params.toString()}`, {
        cache: 'no-store'
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json = (await res.json()) as {
        data: { rows: Row[]; total: number; kpis: Kpis };
      };
      setRows(json.data.rows);
      setTotal(json.data.total);
      setKpis(json.data.kpis);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setLoading(false);
    }
  }

  const fmt = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const totalPages = Math.max(1, Math.ceil(total / 50));

  return (
    <div className="space-y-6">
      {kpis && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi title={t('kpis.revenue')} value={fmt(kpis.totalRevenue)} />
          <Kpi title={t('kpis.avgLtv')} value={fmt(kpis.avgLtv)} />
          <Kpi title={t('kpis.customers')} value={kpis.customerCount.toLocaleString()} />
          <Kpi title={t('kpis.repeatRate')} value={pct(kpis.repeatRate)} />
        </div>
      )}

      {kpis && (
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-4">
          {(['NEW', 'REPEAT', 'HIGH_VALUE', 'INACTIVE'] as Segment[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setSegment((cur) => (cur === s ? '' : s));
                setPage(1);
              }}
              className={
                'rounded-lg border px-3 py-2 text-left text-xs transition ' +
                (segment === s
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 hover:border-slate-300')
              }
            >
              <div className="font-semibold">{t(`segments.${s}`)}</div>
              <div className="mt-0.5 tabular-nums opacity-80">
                {kpis.segments[s].toLocaleString()}
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (setPage(1), void load())}
          placeholder={t('searchPlaceholder')}
          className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={() => {
            setPage(1);
            void load();
          }}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
        >
          {t('search')}
        </button>
        {(segment || q) && (
          <button
            type="button"
            onClick={() => {
              setSegment('');
              setQ('');
              setPage(1);
            }}
            className="text-xs text-slate-500 hover:underline"
          >
            {t('clear')}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left">{t('cols.customer')}</th>
              <th className="px-4 py-2 text-left">{t('cols.segment')}</th>
              <th className="px-4 py-2 text-right">{t('cols.orders')}</th>
              <th className="px-4 py-2 text-right">{t('cols.totalSpent')}</th>
              <th className="px-4 py-2 text-right">{t('cols.ltv')}</th>
              <th className="px-4 py-2 text-left">{t('cols.lastOrder')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  {t('loading')}
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  {t('empty')}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.userId} className="hover:bg-slate-50">
                <td className="px-4 py-2">
                  <div className="font-medium text-slate-900">{r.user.name}</div>
                  <div className="text-xs text-slate-500">{r.user.email}</div>
                </td>
                <td className="px-4 py-2">
                  <SegmentPill segment={r.segment} t={t} />
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{r.orderCount}</td>
                <td className="px-4 py-2 text-right tabular-nums">{fmt(r.totalSpent)}</td>
                <td className="px-4 py-2 text-right font-semibold tabular-nums text-emerald-700">
                  {fmt(r.lifetimeValue)}
                </td>
                <td className="px-4 py-2 text-xs text-slate-600">
                  {r.lastOrderAt ? new Date(r.lastOrderAt).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{t('totalCount', { n: total })}</span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
          >
            ←
          </button>
          <span className="tabular-nums">{page} / {totalPages}</span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}

function SegmentPill({
  segment,
  t
}: {
  segment: Segment;
  t: ReturnType<typeof useTranslations>;
}) {
  const tone: Record<Segment, string> = {
    NEW: 'bg-sky-100 text-sky-700',
    REPEAT: 'bg-emerald-100 text-emerald-700',
    HIGH_VALUE: 'bg-amber-100 text-amber-800',
    INACTIVE: 'bg-slate-200 text-slate-600'
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${tone[segment]}`}>
      {t(`segments.${segment}`)}
    </span>
  );
}
