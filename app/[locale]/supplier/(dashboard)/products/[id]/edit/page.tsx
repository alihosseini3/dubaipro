import { getTranslations } from 'next-intl/server';

import { prisma } from '@/lib/prisma';
import { requireSupplierPermission } from '@/lib/auth/require-supplier';
import { ProductEditor } from '@/components/supplier/products/ProductEditor';

type Props = { params: Promise<{ locale: string; id: string }> };

/**
 * Tabbed product editor: info+SEO, price tiers, variants, and the review
 * status panel. All data flows through /api/supplier/products/[id]* which
 * enforces org scoping — the page itself only gates the permission.
 */
export default async function SupplierEditProductPage({ params }: Props) {
  const { locale, id } = await params;
  await requireSupplierPermission(
    locale,
    'supplier.products.write',
    `/${locale}/supplier/products/${id}/edit`
  );

  const [t, categories] = await Promise.all([
    getTranslations({ locale, namespace: 'supplier.products' }),
    prisma.category.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true }
    })
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
        {t('editTitle')}
      </h1>
      <ProductEditor locale={locale} productId={id} categories={categories} />
    </div>
  );
}
