import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { AdminCard, StatCard } from '@/components/admin/AdminCard';
import { AdminTable, type Column } from '@/components/admin/AdminTable';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { prisma } from '@/lib/prisma';

type Props = { params: Promise<{ locale: string }> };

type RecentRfqRow = {
  id: string;
  productTitle: string;
  supplierName: string;
  quantity: number;
  status: string;
  createdAt: Date;
};

export default async function AdminRootPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin.dashboard' });

  // Single render log per request (no fetches, no self-redirects).
  console.log('admin render');

  const [
    totalProducts,
    totalRfqs,
    totalUsers,
    totalSuppliers,
    openRfqs,
    recentRfqsRaw
  ] = await Promise.all([
    prisma.product.count(),
    prisma.rFQ.count(),
    prisma.user.count(),
    prisma.supplier.count(),
    prisma.rFQ.count({ where: { status: 'OPEN' } }),
    prisma.rFQ.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { title: true } },
        supplier: { select: { name: true } }
      }
    })
  ]);

  const recentRfqs: RecentRfqRow[] = recentRfqsRaw.map((r) => ({
    id: r.id,
    productTitle: r.product.title,
    supplierName: r.supplier.name,
    quantity: r.quantity,
    status: r.status,
    createdAt: r.createdAt
  }));

  const columns: Column<RecentRfqRow>[] = [
    {
      key: 'product',
      header: t('product'),
      render: (r) => (
        <Link
          href={`/${locale}/admin/rfq/${r.id}`}
          className="font-medium text-slate-900 hover:underline"
        >
          {r.productTitle}
        </Link>
      )
    },
    { key: 'supplier', header: t('supplier'), render: (r) => r.supplierName },
    { key: 'quantity', header: t('quantity'), render: (r) => r.quantity },
    {
      key: 'status',
      header: t('status'),
      render: (r) => <StatusBadge status={r.status} variant="rfq" />
    },
    {
      key: 'date',
      header: t('createdAt'),
      render: (r) => r.createdAt.toISOString().slice(0, 10)
    }
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label={t('totalProducts')} value={totalProducts} />
        <StatCard label={t('totalSuppliers')} value={totalSuppliers} />
        <StatCard
          label={t('totalRfqs')}
          value={totalRfqs}
          hint={`${openRfqs} ${t('openRfqs')}`}
        />
        <StatCard label={t('openRfqs')} value={openRfqs} />
        <StatCard label={t('totalUsers')} value={totalUsers} />
      </div>

      <AdminCard
        title={t('recentRfqs')}
        description={t('recentRfqsSubtitle')}
        actions={
          <Link
            href={`/${locale}/admin/rfq`}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-900"
          >
            {t('viewAll')}
          </Link>
        }
      >
        <AdminTable
          columns={columns}
          rows={recentRfqs}
          rowKey={(r) => r.id}
          emptyLabel="—"
        />
      </AdminCard>
    </div>
  );
}
