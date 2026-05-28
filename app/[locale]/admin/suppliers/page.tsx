import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { AdminCard } from '@/components/admin/AdminCard';
import { AdminTable, type Column } from '@/components/admin/AdminTable';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { prisma } from '@/lib/prisma';

type Props = { params: Promise<{ locale: string }> };

type Row = {
  id: string;
  name: string;
  country: string;
  verified: boolean;
  productCount: number;
  rfqCount: number;
};

export default async function AdminSuppliersPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin.suppliers' });
  const tCommon = await getTranslations({ locale, namespace: 'admin.common' });

  const suppliers = await prisma.supplier.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { products: true, rfqs: true } } }
  });

  const rows: Row[] = suppliers.map((s) => ({
    id: s.id,
    name: s.name,
    country: s.country,
    verified: s.verified,
    productCount: s._count.products,
    rfqCount: s._count.rfqs
  }));

  const columns: Column<Row>[] = [
    {
      key: 'name',
      header: t('headerName'),
      render: (r) => (
        <Link href={`/${locale}/admin/suppliers/${r.id}`} className="font-medium text-slate-900 hover:underline">
          {r.name}
        </Link>
      )
    },
    { key: 'country', header: t('headerCountry'), render: (r) => r.country },
    {
      key: 'verified',
      header: t('headerVerified'),
      render: (r) => <StatusBadge status={r.verified ? 'TRUE' : 'FALSE'} variant="bool" />
    },
    { key: 'products', header: t('headerProducts'), render: (r) => r.productCount },
    { key: 'rfqs', header: t('headerRfqs'), render: (r) => r.rfqCount },
    {
      key: 'actions',
      header: tCommon('actions'),
      className: 'text-right',
      render: (r) => (
        <Link
          href={`/${locale}/admin/suppliers/${r.id}`}
          className="rounded-md px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
        >
          {tCommon('edit')}
        </Link>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{t('title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>
        </div>
        <Link
          href={`/${locale}/admin/suppliers/new`}
          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          {t('new')}
        </Link>
      </header>

      <AdminCard>
        <AdminTable columns={columns} rows={rows} rowKey={(r) => r.id} emptyLabel={tCommon('empty')} />
      </AdminCard>
    </div>
  );
}
