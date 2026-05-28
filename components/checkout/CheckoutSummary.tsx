import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { getDisplayCurrency } from '@/lib/currency/context';
import { formatDisplayFromAED } from '@/lib/currency/service';

type SummaryItem = {
  id: string;
  title: string;
  slug: string | null;
  imageUrl: string | null;
  price: number;
  quantity: number;
};

type CheckoutSummaryProps = {
  locale: string;
  items: SummaryItem[];
  itemsTotal: number;
  shippingPrice: number;
  currency: string;
  /**
   * Monetary discount snapshotted onto the order at creation. Always >= 0.
   * When > 0, `couponCode` should be provided for display.
   */
  discountAmount?: number;
  /** Code of the coupon that produced `discountAmount`, shown next to the line. */
  couponCode?: string | null;
  /**
   * Label override for the shipping row. Defaults to `checkout.shippingNotSelected`
   * when no method has been chosen yet.
   */
  shippingLabel?: string | null;
};

/**
 * Sticky order summary used by every checkout step.
 * Renders line items, subtotal, shipping, and grand total — all values read
 * from the authoritative order row (never from the client).
 */
export async function CheckoutSummary({
  locale,
  items,
  itemsTotal,
  shippingPrice,
  currency,
  discountAmount = 0,
  couponCode = null,
  shippingLabel
}: CheckoutSummaryProps) {
  const t = await getTranslations({ locale, namespace: 'checkout' });
  const tp = await getTranslations({ locale, namespace: 'payment' });
  const tc = await getTranslations({ locale, namespace: 'coupon' });
  const display = await getDisplayCurrency(locale);
  const fmt = (amountAED: number) => formatDisplayFromAED(amountAED, display);

  const hasShipping = shippingPrice > 0 || Boolean(shippingLabel);
  const hasDiscount = discountAmount > 0;
  const grandTotal = Math.max(0, itemsTotal - discountAmount) + shippingPrice;

  return (
    <div className="lg:sticky lg:top-24 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        {t('summaryTitle')}
      </h2>

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="flex gap-3">
            <div className="relative h-14 w-14 flex-none overflow-hidden rounded-lg bg-slate-100">
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="h-full w-full object-cover"
                />
              ) : null}
              <span className="absolute -end-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-900 px-1 text-[10px] font-bold text-white">
                {item.quantity}
              </span>
            </div>
            <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
              <Link
                href={item.slug ? `/${locale}/products/${item.slug}` : '#'}
                className="line-clamp-2 text-xs font-semibold text-slate-900 hover:underline"
              >
                {item.title}
              </Link>
              <span className="flex-none text-xs font-semibold text-slate-900">
                {fmt(item.price * item.quantity)}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <dl className="space-y-2 border-t border-slate-100 pt-3 text-sm">
        <div className="flex justify-between text-slate-600">
          <dt>{tp('subtotal')}</dt>
          <dd>{fmt(itemsTotal)}</dd>
        </div>
        {hasDiscount && (
          <div className="flex justify-between text-emerald-700">
            <dt className="font-semibold">
              {tc('discount')}
              {couponCode && (
                <span className="ms-1.5 font-mono text-[11px] text-emerald-800/80">
                  {couponCode}
                </span>
              )}
            </dt>
            <dd className="font-semibold">−{fmt(discountAmount)}</dd>
          </div>
        )}
        <div className="flex justify-between text-slate-600">
          <dt>{tp('shipping')}</dt>
          <dd>
            {hasShipping
              ? `${fmt(shippingPrice)}${shippingLabel ? ` · ${shippingLabel}` : ''}`
              : t('shippingNotSelected')}
          </dd>
        </div>
      </dl>

      <div className="flex items-baseline justify-between border-t border-slate-200 pt-3">
        <span className="text-sm font-semibold text-slate-700">{tp('total')}</span>
        <span className="text-2xl font-bold text-slate-900">{fmt(grandTotal)}</span>
      </div>
    </div>
  );
}
