import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { AdminCard } from '@/components/admin/AdminCard';
import { AdminTable, type Column } from '@/components/admin/AdminTable';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { prisma } from '@/lib/prisma';

type Props = { params: Promise<{ locale: string }> };

type Row = {
  id: string;
  title: string;
  slug: string;
  categoryName: string;
  supplierName: string;
  price: string;
  currency: string;
  stock: number;
  isB2B: boolean;
};

export default async function AdminProductsPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin.products' });
  const tCommon = await getTranslations({ locale, namespace: 'admin.common' });

  const products = await prisma.product.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      category: { select: { name: true } },
      supplier: { select: { name: true } }
    }
  });

  const rows: Row[] = products.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    categoryName: p.category.name,
    supplierName: p.supplier.name,
    price: p.price.toString(),
    currency: p.currency,
    stock: p.stock,
    isB2B: p.isB2B
  }));

  const columns: Column<Row>[] = [
    {
      key: 'title',
      header: t('headerTitle'),
      render: (r) => (
        <Link href={`/${locale}/admin/products/${r.id}`} className="font-medium text-slate-900 hover:underline">
          {r.title}
          <span className="ml-1 text-xs text-slate-400">/{r.slug}</span>
        </Link>
      )
    },
    { key: 'category', header: t('headerCategory'), render: (r) => r.categoryName },
    { key: 'supplier', header: t('headerSupplier'), render: (r) => r.supplierName },
    {
      key: 'price',
      header: t('headerPrice'),
      render: (r) => `${r.price} ${r.currency}`
    },
    { key: 'stock', header: t('headerStock'), render: (r) => r.stock },
    {
      key: 'b2b',
      header: t('headerB2B'),
      render: (r) => <StatusBadge status={r.isB2B ? 'TRUE' : 'FALSE'} variant="bool" />
    },
    {
      key: 'actions',
      header: tCommon('actions'),
      className: 'text-right',
      render: (r) => (
        <Link
          href={`/${locale}/admin/products/${r.id}`}
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
          href={`/${locale}/admin/products/new`}
          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          {t('new')}
        </Link>
      </header>

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
