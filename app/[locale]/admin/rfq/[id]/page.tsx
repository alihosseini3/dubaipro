import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { AdminCard } from '@/components/admin/AdminCard';
import { DeleteButton } from '@/components/admin/DeleteButton';
import { RfqStatusForm } from '@/components/admin/RfqStatusForm';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { prisma } from '@/lib/prisma';

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function AdminRfqDetailPage({ params }: Props) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: 'admin.rfqs' });
  const tCommon = await getTranslations({ locale, namespace: 'admin.common' });

  const rfq = await prisma.rFQ.findUnique({
    where: { id },
    include: {
      product: { select: { id: true, title: true, slug: true, price: true } },
      supplier: { select: { id: true, name: true, country: true } },
      user: { select: { id: true, name: true, email: true } }
    }
  });

  if (!rfq) notFound();

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href={`/${locale}/admin/rfq`}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-900"
          >
            ← {tCommon('back')}
          </Link>
          <h1 className="text-2xl font-semibold text-slate-900">{t('detailTitle')}</h1>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={rfq.status} variant="rfq" />
          <DeleteButton endpoint={`/api/rfq/${rfq.id}`} redirectTo={`/${locale}/admin/rfq`} />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <AdminCard className="lg:col-span-2" title={t('message')}>
          <div className="space-y-4 text-sm text-slate-700">
            <div className="flex flex-wrap gap-x-8 gap-y-3 text-xs text-slate-500">
              <div>
                <div className="font-semibold uppercase tracking-wide">{t('headerProduct')}</div>
                <Link
                  href={`/${locale}/admin/products/${rfq.product.id}`}
                  className="mt-0.5 block text-sm font-medium text-slate-900 hover:underline"
                >
                  {rfq.product.title}
                </Link>
              </div>
              <div>
                <div className="font-semibold uppercase tracking-wide">{t('headerQuantity')}</div>
                <div className="mt-0.5 text-sm font-medium text-slate-900">{rfq.quantity}</div>
              </div>
              <div>
                <div className="font-semibold uppercase tracking-wide">{t('headerBuyer')}</div>
                <div className="mt-0.5 text-sm font-medium text-slate-900">
                  {rfq.user?.name ?? t('guestBuyer')}
                  {rfq.user?.email && (
                    <span className="ml-1 text-xs font-normal text-slate-500">({rfq.user.email})</span>
                  )}
                </div>
              </div>
              <div>
                <div className="font-semibold uppercase tracking-wide">{t('headerSupplier')}</div>
                <div className="mt-0.5 text-sm font-medium text-slate-900">{rfq.supplier.name}</div>
              </div>
              <div>
                <div className="font-semibold uppercase tracking-wide">{t('headerDate')}</div>
                <div className="mt-0.5 text-sm font-medium text-slate-900">
                  {rfq.createdAt.toISOString().slice(0, 10)}
                </div>
              </div>
            </div>

            <div className="whitespace-pre-line rounded-lg border border-slate-200 bg-slate-50 p-4">
              {rfq.message.trim() || t('noMessage')}
            </div>
          </div>
        </AdminCard>

        <AdminCard title={t('changeStatus')}>
          <RfqStatusForm rfqId={rfq.id} currentStatus={rfq.status} />
        </AdminCard>
      </div>
    </div>
  );
}
