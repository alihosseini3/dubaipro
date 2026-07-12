import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { SupplierTierBadge } from '@/components/suppliers/SupplierTierBadge';
import type { ProductSupplier } from '@/types/product';

type SupplierCardProps = {
  supplier: ProductSupplier;
  locale: string;
};

export function SupplierCard({ supplier, locale }: SupplierCardProps) {
  const t = useTranslations('products');
  const initial = supplier.name?.charAt(0).toUpperCase() ?? '?';
  const hasRating = (supplier.ratingCount ?? 0) > 0;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">
        {t('supplier')}
      </h2>

      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-slate-900 text-lg font-bold text-white">
          {initial}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-slate-900">
              {supplier.name}
            </p>
            {supplier.tier && (
              <SupplierTierBadge
                tier={supplier.tier}
                compact
                labels={{
                  verified: t('supplierVerified'),
                  guaranteed: t('supplierGuaranteed')
                }}
              />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {supplier.country && <span>{supplier.country}</span>}
            {hasRating && (
              <span className="font-medium text-amber-600">
                ★ {supplier.ratingAvg!.toFixed(1)} ({supplier.ratingCount})
              </span>
            )}
          </div>
        </div>
      </div>

      <Link
        href={`/${locale}/suppliers/${supplier.id}`}
        className="mt-4 inline-flex w-full items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-900"
      >
        {t('viewSupplier')}
      </Link>
    </section>
  );
}
