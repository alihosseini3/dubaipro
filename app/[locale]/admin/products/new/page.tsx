import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { AdminCard } from '@/components/admin/AdminCard';
import { ProductForm } from '@/components/admin/ProductForm';
import { prisma } from '@/lib/prisma';

type Props = { params: Promise<{ locale: string }> };

export default async function AdminNewProductPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin.products' });
  const tCommon = await getTranslations({ locale, namespace: 'admin.common' });

  const [categories, brands, suppliers] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, slug: true } }),
    prisma.brand.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.supplier.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } })
  ]);

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Link
          href={`/${locale}/admin/products`}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-900"
        >
          ← {tCommon('back')}
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">{t('new')}</h1>
      </header>

      {suppliers.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {t('noSuppliersWarning')}
        </div>
      )}
      {categories.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {t('noCategoriesWarning')}
        </div>
      )}

      <AdminCard>
        <ProductForm
          categories={categories}
          brands={brands}
          suppliers={suppliers}
          locale={locale}
        />
      </AdminCard>
    </div>
  );
}
