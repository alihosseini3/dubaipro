import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { AdminCard } from '@/components/admin/AdminCard';
import { SupplierForm } from '@/components/admin/SupplierForm';
import { prisma } from '@/lib/prisma';

type Props = { params: Promise<{ locale: string }> };

export default async function AdminNewSupplierPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin.suppliers' });
  const tCommon = await getTranslations({ locale, namespace: 'admin.common' });

  const users = await prisma.user.findMany({
    where: { supplier: null },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, email: true }
  });

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Link
          href={`/${locale}/admin/suppliers`}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-900"
        >
          ← {tCommon('back')}
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">{t('new')}</h1>
      </header>

      <AdminCard>
        <SupplierForm users={users} locale={locale} />
      </AdminCard>
    </div>
  );
}
