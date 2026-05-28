import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { Price } from '@/components/currency/Price';
import { WishlistButton } from '@/components/wishlist/WishlistButton';
import type { Product } from '@/types/product';
import { ProductImage } from './ProductImage';

type ProductCardProps = {
  product: Product;
  locale: string;
  isAuthenticated?: boolean;
  inWishlist?: boolean;
};

export function ProductCard({
  product,
  locale,
  isAuthenticated = false,
  inWishlist = false
}: ProductCardProps) {
  const t = useTranslations('products');

  const priceAmount =
    typeof product.price === 'number' ? product.price : Number(product.price);
  const inStock = product.stock > 0;

  const detailsHref = `/${locale}/products/${product.slug}`;
  const rfqHref = `/${locale}/products/${product.slug}/rfq`;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative">
        <Link
          href={detailsHref}
          className="block overflow-hidden"
          aria-label={product.title}
        >
          <ProductImage
            title={product.title}
            src={product.imageUrl ?? undefined}
            aspect="aspect-square"
            zoomOnHover
          />
        </Link>
        <div className="absolute end-3 top-3">
          <WishlistButton
            productId={product.id}
            locale={locale}
            initialActive={inWishlist}
            isAuthenticated={isAuthenticated}
            variant="card"
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {product.category?.name && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
              {product.category.name}
            </span>
          )}
          {product.isB2B && (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 font-semibold text-indigo-700">
              {t('bulkBadge')}
            </span>
          )}
        </div>

        <h2 className="mt-2 line-clamp-2 text-base font-semibold text-slate-900 transition-colors group-hover:text-indigo-700">
          {product.title}
        </h2>

        {product.supplier?.name && (
          <p className="mt-1 line-clamp-1 text-xs text-slate-500">
            {t('by')} <span className="font-medium text-slate-700">{product.supplier.name}</span>
          </p>
        )}

        <div className="mt-3 flex items-end justify-between">
          <div>
            <Price
              amount={priceAmount}
              locale={locale}
              from={product.currency}
              className="text-lg font-bold text-slate-900"
            />
            <span
              className={
                'mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ' +
                (inStock
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-500')
              }
            >
              {inStock
                ? `${t('stock')}: ${product.stock}`
                : t('outOfStock')}
            </span>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Link
            href={detailsHref}
            className="inline-flex flex-1 items-center justify-center rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
          >
            {t('viewDetails')}
          </Link>
          <Link
            href={rfqHref}
            className="inline-flex items-center justify-center rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-900"
          >
            {t('requestQuote')}
          </Link>
        </div>
      </div>
    </article>
  );
}
