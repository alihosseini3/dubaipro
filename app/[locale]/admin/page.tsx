import { getTranslations } from 'next-intl/server';

import { StatCard } from '@/components/admin/AdminCard';
import { prisma } from '@/lib/prisma';

type Props = { params: Promise<{ locale: string }> };

export default async function AdminRootPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin.dashboard' });

  // Single render log per request (no fetches, no self-redirects).
  console.log('admin render');

  const [totalProducts, totalUsers, totalSuppliers] = await Promise.all([
    prisma.product.count(),
    prisma.user.count(),
    prisma.supplier.count()
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label={t('totalProducts')} value={totalProducts} />
        <StatCard label={t('totalSuppliers')} value={totalSuppliers} />
        <StatCard label={t('totalUsers')} value={totalUsers} />
      </div>
    </div>
  );
}
