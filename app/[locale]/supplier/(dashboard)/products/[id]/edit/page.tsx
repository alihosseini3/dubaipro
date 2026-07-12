import { getTranslations } from 'next-intl/server';

import { prisma } from '@/lib/prisma';
import { requireSupplierPermission } from '@/lib/auth/require-supplier';
import { canSubmitProducts } from '@/lib/suppliers/gating';
import { ProductEditor } from '@/components/supplier/products/ProductEditor';
import { ApplicationStatusBanner } from '@/components/supplier/ApplicationStatusBanner';

type Props = { params: Promise<{ locale: string; id: string }> };

/**
 * Tabbed product editor: info+SEO, price tiers, variants, and the review
 * status panel. All data flows through /api/supplier/products/[id]* which
 * enforces org scoping — the page itself only gates the permission.
 */
export default async function SupplierEditProductPage({ params }: Props) {
  const { locale, id } = await params;
  const { supplier } = await requireSupplierPermission(
    locale,
    'supplier.products.write',
    `/${locale}/supplier/products/${id}/edit`
  );

  const [t, categories, gateState] = await Promise.all([
    getTranslations({ locale, namespace: 'supplier.products' }),
    prisma.category.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true }
    }),
    prisma.supplier.findUnique({
      where: { id: supplier.id },
      select: { onboardingStatus: true, status: true, canListProducts: true }
    })
  ]);

  // Editing a draft is allowed before approval, but submitting it isn't. Show
  // why up front rather than letting the status tab fail with a 403.
  const canSubmit = gateState ? canSubmitProducts(gateState).allowed : false;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
        {t('editTitle')}
      </h1>
      {gateState && (
        <ApplicationStatusBanner
          locale={locale}
          supplierId={supplier.id}
          onboardingStatus={gateState.onboardingStatus}
          status={gateState.status}
          canListProducts={gateState.canListProducts}
        />
      )}
      <ProductEditor
        locale={locale}
        productId={id}
        categories={categories}
        canSubmit={canSubmit}
      />
    </div>
  );
}
