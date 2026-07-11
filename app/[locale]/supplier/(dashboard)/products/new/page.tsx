import { getTranslations } from 'next-intl/server';

import { prisma } from '@/lib/prisma';
import { requireSupplierPermission } from '@/lib/auth/require-supplier';
import { ProductCreateForm } from '@/components/supplier/products/ProductCreateForm';

type Props = { params: Promise<{ locale: string }> };

/**
 * Minimal create form — a product starts as DRAFT with the essentials; the
 * full editor (tiers, variants, specs, SEO) opens right after creation.
 */
export default async function SupplierNewProductPage({ params }: Props) {
  const { locale } = await params;
  await requireSupplierPermission(
    locale,
    'supplier.products.write',
    `/${locale}/supplier/products/new`
  );

  const [t, categories] = await Promise.all([
    getTranslations({ locale, namespace: 'supplier.products' }),
    prisma.category.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true }
    })
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {t('newTitle')}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{t('newSubtitle')}</p>
      </div>
      <ProductCreateForm locale={locale} categories={categories} />
    </div>
  );
}
