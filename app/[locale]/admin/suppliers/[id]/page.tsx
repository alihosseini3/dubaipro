import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { AdminCard } from '@/components/admin/AdminCard';
import { DeleteButton } from '@/components/admin/DeleteButton';
import { SupplierForm } from '@/components/admin/SupplierForm';
import { prisma } from '@/lib/prisma';

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function AdminEditSupplierPage({ params }: Props) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: 'admin.suppliers' });
  const tCommon = await getTranslations({ locale, namespace: 'admin.common' });

  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) notFound();

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href={`/${locale}/admin/suppliers`}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-900"
          >
            ← {tCommon('back')}
          </Link>
          <h1 className="text-2xl font-semibold text-slate-900">{t('edit')}</h1>
        </div>
        <DeleteButton
          endpoint={`/api/suppliers/${supplier.id}`}
          redirectTo={`/${locale}/admin/suppliers`}
        />
      </header>

      <AdminCard>
        <SupplierForm
          initial={{
            id: supplier.id,
            userId: supplier.userId,
            name: supplier.name,
            country: supplier.country,
            phone: supplier.phone ?? '',
            verified: supplier.verified
          }}
          users={[]}
          locale={locale}
        />
      </AdminCard>
    </div>
  );
}
