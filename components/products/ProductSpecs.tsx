import { getTranslations } from 'next-intl/server';

import type { Product } from '@/types/product';

type Props = { product: Product; locale: string };

/**
 * Specifications table built from the structured fields we already
 * persist on the Product model. Renders an empty state when nothing
 * worth showing exists, so the tab never feels broken.
 *
 * Server component — no client JS needed.
 */
export async function ProductSpecs({ product, locale }: Props) {
  const t = await getTranslations({ locale, namespace: 'products' });

  type Row = { label: string; value: string };
  const rows: Row[] = [];

  if (product.brand?.name) {
    rows.push({ label: t('specs.brand'), value: product.brand.name });
  }
  if (product.category?.name) {
    rows.push({ label: t('specs.category'), value: product.category.name });
  }
  if (product.supplier?.name) {
    rows.push({ label: t('specs.supplier'), value: product.supplier.name });
  }
  if (product.supplier?.country) {
    rows.push({
      label: t('specs.shipsFrom'),
      value: product.supplier.country
    });
  }
  if (product.isB2B) {
    rows.push({ label: t('specs.b2b'), value: t('yes') });
  }
  if (typeof product.moq === 'number' && product.moq > 0) {
    rows.push({ label: t('specs.moq'), value: String(product.moq) });
  }
  if (typeof product.weight === 'number' && product.weight > 0) {
    rows.push({
      label: t('specs.weight'),
      value: `${product.weight} kg`
    });
  }
  const dims = [product.length, product.width, product.height].filter(
    (n): n is number => typeof n === 'number' && n > 0
  );
  if (dims.length === 3) {
    rows.push({
      label: t('specs.dimensions'),
      value: `${dims[0]} × ${dims[1]} × ${dims[2]} cm`
    });
  }
  if (product.shippingClass) {
    rows.push({
      label: t('specs.shippingClass'),
      value: product.shippingClass
    });
  }
  rows.push({
    label: t('specs.sku'),
    value: product.id.slice(0, 12).toUpperCase()
  });

  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-400">{t('specs.empty')}</p>
    );
  }

  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
      {rows.map((r) => (
        <div
          key={r.label}
          className="flex items-baseline justify-between gap-4 border-b border-dashed border-slate-200 py-2 last:border-0"
        >
          <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {r.label}
          </dt>
          <dd className="text-sm font-semibold text-slate-900">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
