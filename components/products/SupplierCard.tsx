import Link from 'next/link';
import { useTranslations } from 'next-intl';

import type { ProductSupplier } from '@/types/product';

type SupplierCardProps = {
  supplier: ProductSupplier;
  locale: string;
};

export function SupplierCard({ supplier, locale }: SupplierCardProps) {
  const t = useTranslations('products');
  const initial = supplier.name?.charAt(0).toUpperCase() ?? '?';

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
          <p className="truncate text-sm font-semibold text-slate-900">
            {supplier.name}
          </p>
          {supplier.country && (
            <p className="text-xs text-slate-500">{supplier.country}</p>
          )}
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
