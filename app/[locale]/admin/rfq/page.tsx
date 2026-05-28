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
  productTitle: string;
  quantity: number;
  status: string;
  buyerName: string;
  supplierName: string;
  createdAt: Date;
};

const STATUSES = ['OPEN', 'REVIEWING', 'QUOTED', 'ACCEPTED', 'REJECTED', 'CLOSED'] as const;

export default async function AdminRfqsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { status } = await searchParams;
  const t = await getTranslations({ locale, namespace: 'admin.rfqs' });
  const tCommon = await getTranslations({ locale, namespace: 'admin.common' });

  const filter = status && (STATUSES as readonly string[]).includes(status.toUpperCase())
    ? (status.toUpperCase() as (typeof STATUSES)[number])
    : undefined;

  const rfqs = await prisma.rFQ.findMany({
    where: filter ? { status: filter } : {},
    orderBy: { createdAt: 'desc' },
    include: {
      product: { select: { title: true } },
      supplier: { select: { name: true } },
      user: { select: { name: true } }
    }
  });

  const rows: Row[] = rfqs.map((r) => ({
    id: r.id,
    productTitle: r.product.title,
    quantity: r.quantity,
    status: r.status,
    buyerName: r.user?.name ?? t('guestBuyer'),
    supplierName: r.supplier.name,
    createdAt: r.createdAt
  }));

  const columns: Column<Row>[] = [
    {
      key: 'product',
      header: t('headerProduct'),
      render: (r) => (
        <Link href={`/${locale}/admin/rfq/${r.id}`} className="font-medium text-slate-900 hover:underline">
          {r.productTitle}
        </Link>
      )
    },
    { key: 'qty', header: t('headerQuantity'), render: (r) => r.quantity },
    { key: 'status', header: t('headerStatus'), render: (r) => <StatusBadge status={r.status} variant="rfq" /> },
    { key: 'buyer', header: t('headerBuyer'), render: (r) => r.buyerName },
    { key: 'supplier', header: t('headerSupplier'), render: (r) => r.supplierName },
    { key: 'date', header: t('headerDate'), render: (r) => r.createdAt.toISOString().slice(0, 10) }
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/${locale}/admin/rfq`}
          className={
            'rounded-full px-3 py-1 text-xs font-semibold transition ' +
            (!filter ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200')
          }
        >
          {t('filterAll')}
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/${locale}/admin/rfq?status=${s}`}
            className={
              'rounded-full px-3 py-1 text-xs font-semibold transition ' +
              (filter === s
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200')
            }
          >
            {s}
          </Link>
        ))}
      </div>

      <AdminCard>
        <AdminTable columns={columns} rows={rows} rowKey={(r) => r.id} emptyLabel={tCommon('empty')} />
      </AdminCard>
    </div>
  );
}
