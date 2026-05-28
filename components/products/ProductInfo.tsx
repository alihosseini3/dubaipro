import { useTranslations } from 'next-intl';

import type { Product } from '@/types/product';

type ProductInfoProps = {
  product: Product;
};

export function ProductInfo({ product }: ProductInfoProps) {
  const t = useTranslations('products');
  const inStock = product.stock > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {product.category?.name && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
            {product.category.name}
          </span>
        )}
        {product.brand?.name && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
            {product.brand.name}
          </span>
        )}
        {product.isB2B && (
          <span className="rounded-full bg-indigo-100 px-2.5 py-1 font-semibold text-indigo-700">
            {t('bulkAvailable')}
          </span>
        )}
      </div>

      <h1 className="text-2xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-3xl">
        {product.title}
      </h1>

      {product.supplier?.name && (
        <p className="text-sm text-slate-500">
          {t('by')}{' '}
          <span className="font-medium text-slate-800">
            {product.supplier.name}
          </span>
          {product.supplier.country && (
            <span className="ml-2 text-slate-400">· {product.supplier.country}</span>
          )}
        </p>
      )}

      <div className="flex items-center gap-3">
        <span
          className={
            'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ' +
            (inStock
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-slate-100 text-slate-500')
          }
        >
          {inStock
            ? `${t('stock')}: ${product.stock}`
            : t('outOfStock')}
        </span>
        {typeof product.moq === 'number' && product.moq > 0 && (
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
            {t('moq')}: {product.moq}
          </span>
        )}
      </div>

      {product.description && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">
            {t('description')}
          </h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">
            {product.description}
          </p>
        </div>
      )}

      {/* Future: specifications */}
      <section
        aria-label={t('specifications')}
        className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-400"
      >
        {t('specificationsComingSoon')}
      </section>

      {/* Future: reviews */}
      <section
        aria-label={t('reviews')}
        className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-400"
      >
        {t('reviewsComingSoon')}
      </section>
    </div>
  );
}
