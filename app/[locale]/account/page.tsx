import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { StatusBadge } from '@/components/admin/StatusBadge';
import { requireUser } from '@/lib/auth/require-user';
import { prisma } from '@/lib/prisma';
import { getDisplayCurrency } from '@/lib/currency/context';
import { formatDisplayFromAED } from '@/lib/currency/service';

type Props = { params: Promise<{ locale: string }> };

export default async function AccountDashboardPage({ params }: Props) {
  const { locale } = await params;
  const user = await requireUser(locale, '/account');
  const t = await getTranslations({ locale, namespace: 'account' });

  const [totalOrders, recentOrders, display] = await Promise.all([
    prisma.order.count({ where: { userId: user.id } }),
    prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { _count: { select: { items: true } } }
    }),
    getDisplayCurrency(locale)
  ]);

  const fmt = (n: number) => formatDisplayFromAED(n, display);

  const memberSince = new Date(
    // Best effort: we don't have createdAt on SessionUser — fetch.
    (await prisma.user.findUnique({
      where: { id: user.id },
      select: { createdAt: true }
    }))?.createdAt ?? Date.now()
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">
          {t('dashboardGreeting', { name: user.name.split(' ')[0] })}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{t('dashboardSubtitle')}</p>
      </header>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={t('statTotalOrders')}
          value={String(totalOrders)}
          iconPath="M6 2l2 4h8l2-4M4 6h16v14H4zM9 10v6m6-6v6"
        />
        <StatCard
          label={t('statEmail')}
          value={user.email}
          iconPath="M4 6h16v12H4zM4 6l8 7 8-7"
          small
        />
        <StatCard
          label={t('statMemberSince')}
          value={memberSince.toISOString().slice(0, 10)}
          iconPath="M8 2v4M16 2v4M3 9h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"
        />
      </div>

      {/* Recent orders */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            {t('recentOrders')}
          </h2>
          <Link
            href={`/${locale}/account/orders`}
            className="text-xs font-semibold text-orange-600 hover:text-orange-700"
          >
            {t('viewAll')} →
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
            {t('noOrders')}
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {recentOrders.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <Link
                    href={`/${locale}/account/orders/${o.id}`}
                    className="font-mono text-xs font-semibold text-slate-900 hover:underline"
                  >
                    #{o.id.slice(-8).toUpperCase()}
                  </Link>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {o.createdAt.toISOString().slice(0, 10)} ·{' '}
                    {t('itemsCount', { count: o._count.items })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-900">
                    {fmt(Number(o.totalPrice))}
                  </span>
                  <StatusBadge status={o.status} variant="order" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  iconPath,
  small
}: {
  label: string;
  value: string;
  iconPath: string;
  small?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden
          >
            <path d={iconPath} />
          </svg>
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </span>
      </div>
      <p
        className={
          'mt-3 truncate font-bold text-slate-900 ' +
          (small ? 'text-base' : 'text-2xl')
        }
        title={value}
      >
        {value}
      </p>
    </div>
  );
}
