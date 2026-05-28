'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';

import { WishlistButton } from '@/components/wishlist/WishlistButton';
import { SocialProofBadges } from '@/components/conversion/SocialProofBadges';
import type { SocialProofData } from '@/lib/conversion/social-proof';
import type { Product } from '@/types/product';

type Props = {
  product: Product;
  locale: string;
  isAuthenticated: boolean;
  inWishlist: boolean;
  rating: { average: number; count: number };
  socialProof?: SocialProofData;
  /**
   * Pre-rendered <Price> node from the parent server component. We
   * accept it as a child so the buy box can stay a Client Component
   * (state for qty / pending) without dragging the server-only
   * currency context into the bundle.
   */
  priceNode: ReactNode;
  /** Pre-rendered compare-at price node (server-side formatted). */
  compareAtPriceNode?: ReactNode;
};

/**
 * Conversion-focused buy box for the PDP:
 *
 *   - Title + supplier + rating sit at the top so the eye lands here
 *     after scanning the gallery.
 *   - Big price, qty stepper, and a primary "Add to cart" / secondary
 *     "Buy now" stack (Buy Now adds + redirects straight to /cart).
 *   - Trust badges (secure payment / verified supplier / Dubai
 *     dispatch / hassle-free returns) — small, monochrome, just
 *     enough to nudge first-time buyers.
 *   - Delivery estimate is computed from the shipping class fallback
 *     so it always renders; admins can override later.
 *
 * The whole panel is `lg:sticky` so it stays visible while shoppers
 * scroll through specs/reviews on desktop.
 */
export function ProductPurchasePanel({
  product,
  locale,
  isAuthenticated,
  inWishlist,
  rating,
  socialProof,
  priceNode,
  compareAtPriceNode,
}: Props) {
  const t = useTranslations('products');
  const tCart = useTranslations('cart');
  const router = useRouter();
  const inStock = product.stock > 0;
  const compareAt = product.compareAtPrice != null ? Number(product.compareAtPrice) : null;
  const discountPct =
    compareAt != null && compareAt > Number(product.price)
      ? Math.round(((compareAt - Number(product.price)) / compareAt) * 100)
      : null;

  const cap = Math.min(product.stock > 0 ? product.stock : 999, 999);
  const [qty, setQty] = useState(1);
  const [pending, setPending] = useState<'add' | 'buy' | null>(null);
  const [flash, setFlash] = useState<'success' | { error: string } | null>(null);

  const rfqHref = `/${locale}/products/${product.slug}/rfq`;

  function bump(delta: number) {
    setQty((q) => Math.min(cap, Math.max(1, q + delta)));
  }

  async function addToCart(): Promise<boolean> {
    const res = await fetch('/api/cart/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: product.id, quantity: qty })
    });
    if (res.status === 401) {
      router.push(
        `/${locale}/login?from=${encodeURIComponent(
          typeof window !== 'undefined' ? window.location.pathname : ''
        )}`
      );
      return false;
    }
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(payload.error ?? `status ${res.status}`);
    }
    return true;
  }

  async function handleAdd() {
    setPending('add');
    setFlash(null);
    try {
      const ok = await addToCart();
      if (!ok) return;
      setFlash('success');
      router.refresh();
      setTimeout(() => setFlash(null), 2200);
    } catch (e) {
      setFlash({ error: (e as Error).message || tCart('errorGeneric') });
    } finally {
      setPending(null);
    }
  }

  async function handleBuyNow() {
    setPending('buy');
    setFlash(null);
    try {
      const ok = await addToCart();
      if (!ok) return;
      router.push(`/${locale}/cart`);
    } catch (e) {
      setFlash({ error: (e as Error).message || tCart('errorGeneric') });
      setPending(null);
    }
  }

  return (
    <aside className="lg:sticky lg:top-24" data-purchase-panel>
      <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        {/* Tags */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          {product.category?.name && (
            <Link
              href={`/${locale}/categories/${product.category.slug}`}
              className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700 transition hover:bg-slate-200"
            >
              {product.category.name}
            </Link>
          )}
          {product.brand?.name && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
              {product.brand.name}
            </span>
          )}
          {product.isB2B && (
            <span className="rounded-full bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-700">
              {t('bulkAvailable')}
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="text-2xl font-black leading-tight tracking-tight text-slate-900 sm:text-3xl">
          {product.title}
        </h1>

        {/* Supplier + rating row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {product.supplier?.name && (
            <Link
              href={`/${locale}/suppliers/${product.supplier.id}`}
              className="text-slate-600 hover:text-orange-600"
            >
              {t('by')}{' '}
              <span className="font-semibold text-slate-900">
                {product.supplier.name}
              </span>
            </Link>
          )}
          {rating.count > 0 && (
            <span className="inline-flex items-center gap-1.5 text-slate-600">
              <Stars value={rating.average} />
              <span className="font-semibold text-slate-900">
                {rating.average.toFixed(1)}
              </span>
              <span className="text-slate-500">
                ({rating.count} {t('reviews').toLowerCase()})
              </span>
            </span>
          )}
        </div>

        {/* Social proof */}
        {socialProof && <SocialProofBadges data={socialProof} />}

        {/* Price + stock */}
        <div className="space-y-1.5 border-y border-slate-100 py-4">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {t('price')}
            </span>
            {discountPct != null && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
                Save {discountPct}%
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="text-4xl font-black leading-none text-slate-900">{priceNode}</span>
            {compareAtPriceNode && (
              <span className="text-base font-medium text-slate-400 line-through">
                {compareAtPriceNode}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1.5">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${
                inStock
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-rose-50 text-rose-700'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  inStock ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
              />
              {inStock ? t('inStock') : t('outOfStock')}
            </span>
            {inStock && product.stock <= 10 && (
              <span className="text-[11px] font-semibold text-amber-700">
                {t('lowStock', { stock: product.stock })}
              </span>
            )}
          </div>
        </div>

        {/* Delivery */}
        <DeliveryEstimate
          locale={locale}
          shippingClass={product.shippingClass ?? 'normal'}
        />

        {/* Quantity */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {t('quantity')}
          </label>
          <div className="inline-flex items-stretch overflow-hidden rounded-xl border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => bump(-1)}
              disabled={qty <= 1 || !inStock}
              className="px-4 text-lg text-slate-700 transition hover:bg-slate-100 disabled:text-slate-300"
              aria-label={tCart('decrease')}
            >
              −
            </button>
            <span className="min-w-[3rem] border-x border-slate-200 px-4 py-2 text-center text-base font-bold text-slate-900">
              {qty}
            </span>
            <button
              type="button"
              onClick={() => bump(+1)}
              disabled={qty >= cap || !inStock}
              className="px-4 text-lg text-slate-700 transition hover:bg-slate-100 disabled:text-slate-300"
              aria-label={tCart('increase')}
            >
              +
            </button>
          </div>
        </div>

        {/* CTAs */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleAdd}
            disabled={!inStock || pending !== null}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3.5 text-sm font-bold text-white shadow-[0_6px_18px_rgba(249,115,22,0.35)] transition hover:-translate-y-0.5 hover:bg-orange-600 hover:shadow-[0_10px_24px_rgba(249,115,22,0.5)] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
          >
            {pending === 'add' ? tCart('adding') : tCart('addToCart')}
          </button>

          <button
            type="button"
            onClick={handleBuyNow}
            disabled={!inStock || pending !== null}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-md disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
          >
            {pending === 'buy' ? tCart('adding') : t('buyNow')}
          </button>

          <div className="grid grid-cols-2 gap-2">
            <Link
              href={rfqHref}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              {t('requestQuote')}
            </Link>
            <WishlistButton
              productId={product.id}
              locale={locale}
              initialActive={inWishlist}
              isAuthenticated={isAuthenticated}
              variant="detail"
            />
          </div>
        </div>

        {flash === 'success' && (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
            {tCart('addedToCart')} ·{' '}
            <Link
              href={`/${locale}/cart`}
              className="underline decoration-emerald-300 underline-offset-2 hover:text-emerald-900"
            >
              {t('viewCart')}
            </Link>
          </p>
        )}
        {flash && typeof flash === 'object' && (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
            {flash.error}
          </p>
        )}

        {/* Trust badges */}
        <TrustBadges />
      </div>
    </aside>
  );
}

/* -------------------------------------------------------------------------- */
/* Sub-components                                                             */
/* -------------------------------------------------------------------------- */

function Stars({ value }: { value: number }) {
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return (
    <span className="inline-flex" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => {
        const filled = i < full || (i === full && half);
        return (
          <svg
            key={i}
            viewBox="0 0 24 24"
            className={`h-3.5 w-3.5 ${filled ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'}`}
          >
            <path d="M12 17.3l-6.16 3.7 1.64-7.03L2 9.24l7.19-.62L12 2l2.81 6.62 7.19.62-5.48 4.73 1.64 7.03z" />
          </svg>
        );
      })}
    </span>
  );
}

function DeliveryEstimate({
  locale,
  shippingClass
}: {
  locale: string;
  shippingClass: string;
}) {
  const t = useTranslations('products');
  // Cheap deterministic estimate from shipping class until the
  // shipping zones API exposes a per-class lead time. Replace with a
  // call to `/api/shipping/quote?productId=...` once that exists.
  const days = shippingClass === 'express' ? '1–2' : shippingClass === 'bulky' ? '5–9' : '2–5';
  const today = new Date();
  const lo = addDays(today, shippingClass === 'express' ? 1 : 2);
  const hi = addDays(today, shippingClass === 'express' ? 2 : shippingClass === 'bulky' ? 9 : 5);
  return (
    <div className="rounded-xl bg-slate-50 p-3.5">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7h13v10H3zM16 10h3l2 3v4h-5" />
            <circle cx="7" cy="20" r="2" />
            <circle cx="17" cy="20" r="2" />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-900">
            {t('delivery.title')} <span className="text-slate-500">·</span>{' '}
            <span className="font-bold text-emerald-700">
              {formatRange(lo, hi, locale)}
            </span>
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {t('delivery.shipsFrom')} ·{' '}
            <span className="font-semibold text-slate-700">
              {t('delivery.estimate', { days })}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

function TrustBadges() {
  const t = useTranslations('products');
  const items: Array<{ label: string; icon: React.ReactNode }> = [
    {
      label: t('trust.securePayment'),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      )
    },
    {
      label: t('trust.verifiedSupplier'),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z" />
        </svg>
      )
    },
    {
      label: t('trust.shipsFromDubai'),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
        </svg>
      )
    },
    {
      label: t('trust.easyReturns'),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" />
        </svg>
      )
    }
  ];
  return (
    <ul className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-4">
      {items.map((it) => (
        <li
          key={it.label}
          className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] font-semibold text-slate-700"
        >
          <span className="text-slate-500">{it.icon}</span>
          <span className="leading-tight">{it.label}</span>
        </li>
      ))}
    </ul>
  );
}

/* -------- date helpers -------- */

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function formatRange(lo: Date, hi: Date, locale: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${lo.toLocaleDateString(locale, opts)} – ${hi.toLocaleDateString(locale, opts)}`;
}
