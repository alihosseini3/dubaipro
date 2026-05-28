'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import type { CouponStatsDTO, CouponUsageDTO } from '@/types/coupon';

type Props = { couponId: string };

type Payload = { data: { stats: CouponStatsDTO; usages: CouponUsageDTO[] } };

/**
 * Lazy-loaded analytics block for the admin coupon edit page. Fetches
 * `/api/admin/coupons/[id]/stats` once on mount and renders aggregate
 * usage + the latest 100 redemptions.
 */
export function CouponStatsPanel({ couponId }: Props) {
  const t = useTranslations('admin.coupons');
  const [stats, setStats] = useState<CouponStatsDTO | null>(null);
  const [usages, setUsages] = useState<CouponUsageDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/coupons/${couponId}/stats`, {
          cache: 'no-store'
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const json = (await res.json()) as Payload;
        if (cancelled) return;
        setStats(json.data.stats);
        setUsages(json.data.usages);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'load_failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [couponId]);

  if (loading) {
    return (
      <p className="text-sm text-slate-500">{t('statsLoading')}</p>
    );
  }
  if (error || !stats) {
    return (
      <p role="alert" className="text-sm text-red-600">
        {error ?? 'error'}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <Stat label={t('statTotalUsage')} value={String(stats.totalUsage)} />
        <Stat
          label={t('statRevenueImpact')}
          value={stats.revenueImpact.toFixed(2)}
        />
        <Stat label={t('statUniqueUsers')} value={String(stats.uniqueUsers)} />
      </div>

      {usages.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
          {t('statsEmpty')}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <Th>{t('thUsedAt')}</Th>
                <Th>{t('thUser')}</Th>
                <Th>{t('thOrder')}</Th>
                <Th className="text-right">{t('thDiscount')}</Th>
                <Th className="text-right">{t('thOrderTotal')}</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {usages.map((u) => (
                <tr key={u.id}>
                  <Td>{new Date(u.usedAt).toLocaleString()}</Td>
                  <Td>
                    <div className="font-medium text-slate-900">
                      {u.userName ?? u.userId.slice(0, 8)}
                    </div>
                    {u.userEmail && (
                      <div className="text-xs text-slate-500">{u.userEmail}</div>
                    )}
                  </Td>
                  <Td className="font-mono text-xs">{u.orderId.slice(0, 12)}</Td>
                  <Td className="text-right font-semibold text-emerald-700">
                    -{u.discountAmount.toFixed(2)}
                  </Td>
                  <Td className="text-right">{u.orderTotal.toFixed(2)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-xl font-bold text-slate-900">{value}</div>
    </div>
  );
}

function Th({
  children,
  className = ''
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={
        'px-3 py-2 text-start text-[10px] font-semibold uppercase tracking-wider text-slate-500 ' +
        className
      }
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = ''
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={'px-3 py-2 align-top ' + className}>{children}</td>;
}
