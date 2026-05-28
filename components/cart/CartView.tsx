'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';

import { CouponPanel } from './CouponPanel';
import { PriceView } from '@/components/currency/PriceView';
import type { CartDTO } from '@/types/cart';
import type { DisplayCurrency } from '@/types/currency';

type CartViewProps = {
  initialCart: CartDTO;
  locale: string;
  display: DisplayCurrency;
};

export function CartView({ initialCart, locale, display }: CartViewProps) {
  const t = useTranslations('cart');
  const router = useRouter();
  const [cart, setCart] = useState(initialCart);
  const [pending, startTransition] = useTransition();
  const [checkoutState, setCheckoutState] = useState<
    { type: 'idle' } | { type: 'error'; message: string }
  >({ type: 'idle' });

  async function mutate(fn: () => Promise<Response>) {
    const res = await fn();
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(payload.error ?? `status ${res.status}`);
    }
    const json = (await res.json()) as { data: CartDTO };
    setCart(json.data);
    startTransition(() => router.refresh());
  }

  async function setQty(productId: string, quantity: number) {
    try {
      await mutate(() =>
        fetch('/api/cart/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId, quantity, replace: true })
        })
      );
    } catch {
      /* swallow; keep prior state */
    }
  }

  async function remove(productId: string) {
    try {
      await mutate(() =>
        fetch('/api/cart/remove', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId })
        })
      );
    } catch {
      /* swallow */
    }
  }

  async function checkout() {
    setCheckoutState({ type: 'idle' });
    try {
      const res = await fetch('/api/order/create', { method: 'POST' });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error ?? `status ${res.status}`);
      }
      const json = (await res.json()) as { data: { id: string } };
      // Send to checkout (payment) rather than directly to the receipt.
      router.push(`/${locale}/checkout/${json.data.id}`);
    } catch (err) {
      setCheckoutState({
        type: 'error',
        message: err instanceof Error ? err.message : t('errorGeneric')
      });
    }
  }

  if (cart.items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <CartIcon />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">{t('emptyTitle')}</h2>
        <p className="mt-1 text-sm text-slate-500">{t('emptyDescription')}</p>
        <Link
          href={`/${locale}/products`}
          className="mt-5 inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          {t('browseProducts')}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <section className="lg:col-span-8 space-y-3">
        {cart.items.map((item) => {
          const price = Number(item.product.price);
          return (
            <article
              key={item.id}
              className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <Link
                href={`/${locale}/products/${item.product.slug}`}
                className="block h-24 w-24 flex-none overflow-hidden rounded-xl bg-slate-100"
              >
                {item.product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.product.imageUrl}
                    alt={item.product.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-300">
                    <CartIcon />
                  </div>
                )}
              </Link>

              <div className="flex flex-1 flex-col">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/${locale}/products/${item.product.slug}`}
                    className="line-clamp-2 text-sm font-semibold text-slate-900 hover:underline"
                  >
                    {item.product.title}
                  </Link>
                  <button
                    type="button"
                    onClick={() => remove(item.productId)}
                    className="text-xs font-medium text-slate-400 transition hover:text-red-600"
                  >
                    {t('remove')}
                  </button>
                </div>

                <div className="mt-auto flex items-end justify-between pt-3">
                  <div className="inline-flex items-center rounded-lg border border-slate-300 bg-white">
                    <button
                      type="button"
                      onClick={() => setQty(item.productId, item.quantity - 1)}
                      disabled={pending || item.quantity <= 1}
                      className="px-3 py-1.5 text-slate-700 transition hover:bg-slate-100 disabled:text-slate-300"
                      aria-label={t('decrease')}
                    >
                      −
                    </button>
                    <span className="min-w-[2.25rem] border-x border-slate-200 px-3 py-1.5 text-center text-sm font-semibold text-slate-900">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQty(item.productId, item.quantity + 1)}
                      disabled={
                        pending ||
                        (item.product.stock > 0 &&
                          item.quantity >= item.product.stock)
                      }
                      className="px-3 py-1.5 text-slate-700 transition hover:bg-slate-100 disabled:text-slate-300"
                      aria-label={t('increase')}
                    >
                      +
                    </button>
                  </div>

                  <div className="text-right">
                    <PriceView
                      amount={item.lineTotal}
                      display={display}
                      className="text-sm font-bold text-slate-900"
                    />
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      <PriceView amount={price} display={display} /> ×{' '}
                      {item.quantity}
                    </div>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <aside className="lg:col-span-4">
        <div className="lg:sticky lg:top-24 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t('summary')}
          </h2>

          <dl className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <dt>{t('itemsCount', { count: cart.itemCount })}</dt>
              <dd>
                <PriceView amount={cart.subtotal} display={display} />
              </dd>
            </div>
            {cart.discount > 0 && cart.coupon && (
              <div className="flex justify-between text-emerald-700">
                <dt className="font-semibold">
                  {t('discount')}{' '}
                  <span className="font-mono text-[11px] text-emerald-800/80">
                    {cart.coupon.code}
                  </span>
                </dt>
                <dd className="font-semibold">
                  −<PriceView amount={cart.discount} display={display} />
                </dd>
              </div>
            )}
            <div className="flex justify-between text-slate-400">
              <dt>{t('shipping')}</dt>
              <dd>{t('calculatedAtCheckout')}</dd>
            </div>
          </dl>

          <CouponPanel cart={cart} onChange={setCart} display={display} />

          <div className="flex items-baseline justify-between border-t border-slate-200 pt-3">
            <span className="text-sm font-semibold text-slate-700">
              {t('total')}
            </span>
            <PriceView
              amount={cart.total}
              display={display}
              className="text-xl font-bold text-slate-900"
            />
          </div>

          <button
            type="button"
            onClick={checkout}
            disabled={pending || cart.items.length === 0}
            className="inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {t('checkout')}
          </button>

          {checkoutState.type === 'error' && (
            <p className="text-xs font-medium text-red-600">
              {checkoutState.message}
            </p>
          )}

          <p className="text-[11px] leading-relaxed text-slate-400">
            {t('paymentHint')}
          </p>
        </div>
      </aside>
    </div>
  );
}

function CartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 3h2l.4 2M7 13h10l4-8H5.4" />
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
    </svg>
  );
}
