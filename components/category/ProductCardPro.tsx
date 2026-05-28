'use client';

import { useState } from 'react';
import Link from 'next/link';
import { WishlistButton } from '@/components/wishlist/WishlistButton';
import { formatPrice } from '@/lib/currency/service';
import type { Currency } from '@/types/currency';
import { ProductImage } from '@/components/products/ProductImage';
import type { FilteredProduct } from '@/lib/categories/filter';

type Props = {
  product: FilteredProduct;
  locale: string;
  isAuthenticated?: boolean;
  inWishlist?: boolean;
};

function StarRating({ rating, count }: { rating: number; count: number }) {
  const rounded = Math.round(rating);
  return (
    <div className="flex items-center gap-1" aria-label={`${rating.toFixed(1)} out of 5`}>
      <div className="flex" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <svg
            key={i}
            viewBox="0 0 20 20"
            className={`h-3 w-3 ${i <= rounded ? 'text-amber-400' : 'text-slate-200'}`}
            fill="currentColor"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
      <span className="text-[11px] text-slate-400">({count})</span>
    </div>
  );
}

export function ProductCardPro({
  product,
  locale,
  isAuthenticated = false,
  inWishlist = false,
}: Props) {
  const priceAmount = Number(product.price);
  const compareAt = product.compareAtPrice != null ? Number(product.compareAtPrice) : null;
  const discountPct =
    compareAt != null && compareAt > priceAmount
      ? Math.round(((compareAt - priceAmount) / compareAt) * 100)
      : null;
  const inStock = product.stock > 0;
  const isLowStock = inStock && product.stock <= 5;
  const detailsHref = `/${locale}/products/${product.slug}`;

  const [addPending, setAddPending] = useState(false);
  const [addDone, setAddDone] = useState(false);

  const handleQuickAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (addPending || !inStock) return;
    if (!isAuthenticated) {
      window.location.href = `/${locale}/login?from=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    setAddPending(true);
    try {
      await fetch('/api/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, quantity: 1 }),
      });
      setAddDone(true);
      setTimeout(() => setAddDone(false), 2000);
    } finally {
      setAddPending(false);
    }
  };

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-md">
      {/* Image container */}
      <div className="relative overflow-hidden">
        <Link href={detailsHref} aria-label={product.title} className="block">
          <ProductImage
            title={product.title}
            src={product.imageUrl ?? undefined}
            aspect="aspect-square"
            zoomOnHover
          />
        </Link>

        {/* Wishlist */}
        <div className="absolute end-2 top-2 z-10">
          <WishlistButton
            productId={product.id}
            locale={locale}
            initialActive={inWishlist}
            isAuthenticated={isAuthenticated}
            variant="card"
          />
        </div>

        {/* Top-start badge stack */}
        <div className="absolute start-2 top-2 flex flex-col items-start gap-1">
          {!inStock && (
            <span className="rounded-full bg-slate-900/75 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
              Out of stock
            </span>
          )}
          {discountPct != null && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
              -{discountPct}%
            </span>
          )}
          {product.shippingClass === 'express' && inStock && (
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
              Fast Delivery
            </span>
          )}
          {isLowStock && (
            <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm animate-pulse">
              Only {product.stock} left!
            </span>
          )}
        </div>

        {/* Bottom-start badge stack */}
        {product.isB2B && (
          <div className="absolute bottom-2 start-2 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white">
            B2B
          </div>
        )}

        {/* Hover quick-view bar */}
        <div className="absolute inset-x-0 bottom-0 translate-y-full bg-slate-900 transition-transform duration-200 group-hover:translate-y-0">
          <Link
            href={detailsHref}
            className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path
                fillRule="evenodd"
                d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                clipRule="evenodd"
              />
            </svg>
            Quick View
          </Link>
        </div>
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col p-3.5">
        {/* Brand */}
        {product.brand?.name && (
          <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-600">
            {product.brand.name}
          </p>
        )}

        {/* Title */}
        <h2 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-slate-900 transition-colors group-hover:text-indigo-700">
          <Link href={detailsHref}>{product.title}</Link>
        </h2>

        {/* Supplier */}
        {product.supplier?.name && (
          <p className="mt-1 line-clamp-1 text-xs text-slate-500">
            by{' '}
            <span className="font-medium text-slate-700">{product.supplier.name}</span>
            {product.supplier.country && (
              <span className="text-slate-400"> · {product.supplier.country}</span>
            )}
          </p>
        )}

        {/* Rating */}
        {product.avgRating != null && product.reviewCount > 0 && (
          <div className="mt-1.5">
            <StarRating rating={product.avgRating} count={product.reviewCount} />
          </div>
        )}

        {/* Price & stock */}
        <div className="mt-auto pt-3">
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-1.5">
                <span className="text-base font-bold text-slate-900">
                  {formatPrice(priceAmount, (product.currency as Currency) || 'AED', locale)}
                </span>
                {compareAt != null && compareAt > priceAmount && (
                  <span className="text-[11px] font-medium text-slate-400 line-through">
                    {formatPrice(compareAt, (product.currency as Currency) || 'AED', locale)}
                  </span>
                )}
              </div>
              <span
                className={`mt-0.5 block text-[10px] font-medium ${
                  inStock ? 'text-emerald-600' : 'text-slate-400'
                }`}
              >
                {inStock ? `${product.stock} in stock` : 'Out of Stock'}
              </span>
            </div>

            {/* Quick add to cart */}
            <button
              type="button"
              onClick={handleQuickAdd}
              disabled={!inStock || addPending}
              aria-label="Add to cart"
              className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-white transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                addDone
                  ? 'bg-emerald-500 hover:bg-emerald-600'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {addDone ? (
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : addPending ? (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zm11 15a1 1 0 100 2 1 1 0 000-2zM6 16a1 1 0 100 2 1 1 0 000-2z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
