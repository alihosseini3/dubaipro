import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { AdminCard } from '@/components/admin/AdminCard';
import { AdminTable, type Column } from '@/components/admin/AdminTable';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { prisma } from '@/lib/prisma';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
};

type Row = {
  id: string;
  customer: string;
  itemsCount: number;
  total: string;
  status: string;
  createdAt: Date;
};

const STATUSES = [
  'PENDING',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED'
] as const;

export default async function AdminOrdersPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { status } = await searchParams;
  const t = await getTranslations({ locale, namespace: 'admin.orders' });
  const tCommon = await getTranslations({ locale, namespace: 'admin.common' });

  const filter =
    status && (STATUSES as readonly string[]).includes(status.toUpperCase())
      ? (status.toUpperCase() as (typeof STATUSES)[number])
      : undefined;

  const orders = await prisma.order.findMany({
    where: filter ? { status: filter } : {},
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { name: true, email: true } },
      _count: { select: { items: true } }
    }
  });

  const rows: Row[] = orders.map((o) => ({
    id: o.id,
    customer: o.user?.name ?? o.user?.email ?? '—',
    itemsCount: o._count.items,
    total: Number(o.totalPrice).toFixed(2),
    status: o.status,
    createdAt: o.createdAt
  }));

  const columns: Column<Row>[] = [
    {
      key: 'order',
      header: t('headerOrder'),
      render: (r) => (
        <Link
          href={`/${locale}/admin/orders/${r.id}`}
          className="font-mono text-xs font-medium text-slate-900 hover:underline"
        >
          #{r.id.slice(-8).toUpperCase()}
        </Link>
      )
    },
    {
      key: 'customer',
      header: t('headerCustomer'),
      render: (r) => r.customer
    },
    {
      key: 'items',
      header: t('headerItems'),
      render: (r) => r.itemsCount
    },
    {
      key: 'total',
      header: t('headerTotal'),
      render: (r) => <span className="font-semibold text-slate-900">{r.total}</span>
    },
    {
      key: 'status',
      header: t('headerStatus'),
      render: (r) => <StatusBadge status={r.status} variant="order" />
    },
    {
      key: 'date',
      header: t('headerDate'),
      render: (r) => r.createdAt.toISOString().slice(0, 10)
    }
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/${locale}/admin/orders`}
          className={
            'rounded-full px-3 py-1 text-xs font-semibold transition ' +
            (!filter
              ? 'bg-slate-900 text-white'
              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100')
          }
        >
          {t('filterAll')}
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/${locale}/admin/orders?status=${s}`}
            className={
              'rounded-full px-3 py-1 text-xs font-semibold transition ' +
              (filter === s
                ? 'bg-slate-900 text-white'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100')
            }
          >
            {s}
          </Link>
        ))}
      </div>

      <AdminCard>
        <AdminTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          emptyLabel={tCommon('empty')}
        />
      </AdminCard>
    </div>
  );
}
