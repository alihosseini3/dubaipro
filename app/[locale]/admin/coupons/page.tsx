import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { AdminCard } from '@/components/admin/AdminCard';
import { AdminTable, type Column } from '@/components/admin/AdminTable';
import { CouponRowActions } from '@/components/admin/CouponRowActions';
import { requireAdmin } from '@/lib/auth/require-admin';
import { listCoupons } from '@/lib/coupon/service';
import type { CouponDTO } from '@/types/coupon';

type Props = { params: Promise<{ locale: string }> };

export default async function AdminCouponsPage({ params }: Props) {
  const { locale } = await params;
  await requireAdmin(locale, `/${locale}/admin/coupons`);

  const t = await getTranslations({ locale, namespace: 'admin.coupons' });
  const tCommon = await getTranslations({ locale, namespace: 'admin.common' });

  const coupons = await listCoupons();

  const columns: Column<CouponDTO>[] = [
    {
      key: 'code',
      header: t('headerCode'),
      render: (c) => (
        <div>
          <Link
            href={`/${locale}/admin/coupons/${c.id}/edit`}
            className="font-mono text-sm font-bold text-slate-900 hover:underline"
          >
            {c.code}
          </Link>
          {c.description && (
            <p className="line-clamp-1 text-xs text-slate-500">
              {c.description}
            </p>
          )}
        </div>
      )
    },
    {
      key: 'value',
      header: t('headerValue'),
      render: (c) =>
        c.type === 'PERCENTAGE' ? (
          <span className="font-semibold text-slate-900">{c.value}%</span>
        ) : (
          <span className="font-semibold text-slate-900">
            {c.value.toFixed(2)}
          </span>
        )
    },
    {
      key: 'usage',
      header: t('headerUsage'),
      render: (c) => (
        <UsageStat used={c.usedCount} limit={c.usageLimit} t={t} />
      )
    },
    {
      key: 'expires',
      header: t('headerExpiresAt'),
      render: (c) =>
        c.expiresAt ? (
          <span
            className={
              new Date(c.expiresAt).getTime() < Date.now()
                ? 'text-red-600'
                : 'text-slate-600'
            }
          >
            {new Date(c.expiresAt).toISOString().slice(0, 10)}
          </span>
        ) : (
          <span className="text-slate-400">{t('neverExpires')}</span>
        )
    },
    {
      key: 'actions',
      header: '',
      render: (c) => (
        <CouponRowActions id={c.id} locale={locale} isActive={c.isActive} />
      )
    }
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{t('title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>
        </div>
        <Link
          href={`/${locale}/admin/coupons/new`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
        >
          <span className="text-base leading-none">+</span>
          {t('new')}
        </Link>
      </header>

      <AdminCard>
        <AdminTable
          columns={columns}
          rows={coupons}
          rowKey={(c) => c.id}
          emptyLabel={tCommon('empty')}
        />
      </AdminCard>
    </div>
  );
}

function UsageStat({
  used,
  limit,
  t
}: {
  used: number;
  limit: number | null;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  if (limit == null) {
    return (
      <span className="text-sm text-slate-700">
        {used} <span className="text-slate-400">/ {t('unlimited')}</span>
      </span>
    );
  }
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const danger = pct >= 90;
  return (
    <div className="min-w-[120px]">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-semibold text-slate-900">{used}</span>
        <span className="text-slate-400">/ {limit}</span>
      </div>
      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={
            'h-full rounded-full ' +
            (danger ? 'bg-red-500' : 'bg-emerald-500')
          }
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
