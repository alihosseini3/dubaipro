'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';

type Props = {
  productId: string;
  productSlug: string;
  productTitle: string;
  imageUrl: string | null;
  /** Pre-rendered <Price> node from the parent server component. */
  priceNode: ReactNode;
  locale: string;
  inStock: boolean;
};

/**
 * Sticky buy bar that slides up from the bottom when the main
 * purchase panel scrolls out of view. Mobile UX pattern lifted from
 * Amazon / Shopify Plus templates — keeps the primary CTA always
 * one tap away without crowding the layout.
 *
 * Visibility is driven by an IntersectionObserver on the
 * `[data-purchase-panel]` element rendered by `ProductPurchasePanel`.
 */
export function StickyBuyBar({
  productId,
  productTitle,
  imageUrl,
  priceNode,
  locale,
  inStock
}: Props) {
  const tCart = useTranslations('cart');
  const t = useTranslations('products');
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const target = document.querySelector('[data-purchase-panel]');
    if (!target) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) setVisible(!e.isIntersecting);
      },
      { rootMargin: '-100px 0px 0px 0px', threshold: 0 }
    );
    obs.observe(target);
    return () => obs.disconnect();
  }, []);

  async function handleAdd() {
    setPending(true);
    try {
      const res = await fetch('/api/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity: 1 })
      });
      if (res.status === 401) {
        window.location.href = `/${locale}/login?from=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      if (res.ok) {
        // Soft success animation; full feedback lives on the panel.
        const el = document.querySelector('[data-sticky-bar-cta]');
        el?.classList.add('animate-pulse');
        setTimeout(() => el?.classList.remove('animate-pulse'), 1200);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      aria-hidden={!visible}
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-3 transition-all duration-300 ${
        visible
          ? 'translate-y-0 opacity-100'
          : 'translate-y-full opacity-0'
      }`}
    >
      <div className="pointer-events-auto mx-auto flex max-w-3xl items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 p-2.5 shadow-xl ring-1 ring-black/5 backdrop-blur sm:p-3">
        <Link
          href={`#top`}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt=""
              className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-slate-200"
            />
          ) : (
            <span className="h-12 w-12 shrink-0 rounded-lg bg-slate-100" />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">
              {productTitle}
            </p>
            <div className="block text-base font-black text-orange-600">
              {priceNode}
            </div>
          </div>
        </Link>

        <button
          type="button"
          data-sticky-bar-cta
          onClick={handleAdd}
          disabled={!inStock || pending}
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-300 sm:px-5 sm:text-sm"
        >
          {pending
            ? tCart('adding')
            : inStock
              ? tCart('addToCart')
              : t('outOfStock')}
        </button>
      </div>
    </div>
  );
}

