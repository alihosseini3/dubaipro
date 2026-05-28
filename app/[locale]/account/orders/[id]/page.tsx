import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { StatusBadge } from '@/components/admin/StatusBadge';
import { OrderTimeline } from '@/components/orders/OrderTimeline';
import { requireUser } from '@/lib/auth/require-user';
import { prisma } from '@/lib/prisma';
import { getDisplayCurrency } from '@/lib/currency/context';
import { formatDisplayFromAED } from '@/lib/currency/service';

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function AccountOrderDetailPage({ params }: Props) {
  const { locale, id } = await params;
  const user = await requireUser(locale, `/account/orders/${id}`);
  const t = await getTranslations({ locale, namespace: 'account' });
  const tOrders = await getTranslations({ locale, namespace: 'orders' });
  const tPayment = await getTranslations({ locale, namespace: 'payment' });

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          product: {
            select: { id: true, title: true, slug: true, imageUrl: true }
          }
        }
      },
      address: true,
      shippingMethod: true,
      payments: { orderBy: { createdAt: 'desc' }, take: 1 }
    }
  });

  if (!order) notFound();
  // Ownership check — also covers admins intentionally because admins use
  // a different UI at /admin/orders/[id].
  if (order.userId !== user.id) notFound();

  const display = await getDisplayCurrency(locale);
  const fmt = (n: number) => formatDisplayFromAED(n, display);

  const total = Number(order.totalPrice);
  const shipping = Number(order.shippingPrice);
  const discount = Number(order.discountAmount);
  const subtotal = order.items.reduce(
    (s, i) => s + Number(i.price) * i.quantity,
    0
  );
  const payment = order.payments[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href={`/${locale}/account/orders`}
          className="text-xs font-semibold text-slate-500 transition hover:text-slate-900"
        >
          ← {t('backToOrders')}
        </Link>
        <StatusBadge status={order.status} variant="order" />
      </div>

      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-slate-500">
          {tOrders('orderNumber')}
        </p>
        <h1 className="mt-1 font-mono text-lg font-semibold text-slate-900">
          {order.id}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {order.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
        </p>
      </header>

      <OrderTimeline
        locale={locale}
        status={order.status}
        updatedAt={order.updatedAt}
        trackingCode={order.trackingCode}
        carrier={order.carrier}
        shippingMethodName={order.shippingMethod?.name ?? null}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">
          {t('items')}
        </h2>
        <ul className="mt-4 divide-y divide-slate-100">
          {order.items.map((item) => (
            <li key={item.id} className="flex gap-4 py-4">
              <div className="h-16 w-16 flex-none overflow-hidden rounded-lg bg-slate-100">
                {item.product?.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.product.imageUrl}
                    alt={item.product.title}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="flex flex-1 items-start justify-between">
                <div>
                  <Link
                    href={`/${locale}/products/${item.product?.slug ?? ''}`}
                    className="text-sm font-semibold text-slate-900 hover:underline"
                  >
                    {item.product?.title ?? '—'}
                  </Link>
                  <p className="mt-1 text-xs text-slate-500">
                    {tOrders('qty')}: {item.quantity}
                  </p>
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  {fmt(Number(item.price) * item.quantity)}
                </div>
              </div>
            </li>
          ))}
        </ul>

        <dl className="mt-5 space-y-1 border-t border-slate-200 pt-4 text-sm">
          <Row label={t('subtotal')} value={fmt(subtotal)} />
          {shipping > 0 && (
            <Row label={t('shipping')} value={fmt(shipping)} />
          )}
          {discount > 0 && (
            <Row
              label={t('discount')}
              value={`- ${fmt(discount)}`}
              valueClass="text-emerald-600"
            />
          )}
          <div className="mt-2 flex items-baseline justify-between border-t border-slate-200 pt-3">
            <dt className="text-sm font-semibold text-slate-700">
              {tOrders('total')}
            </dt>
            <dd className="text-xl font-bold text-slate-900">{fmt(total)}</dd>
          </div>
        </dl>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            {t('shippingAddress')}
          </h2>
          {order.address ? (
            <div className="mt-3 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">
                {order.address.fullName}
              </p>
              <p className="mt-1">{order.address.phone}</p>
              <p className="mt-1">
                {order.address.addressLine}, {order.address.city},{' '}
                {order.address.country} {order.address.postalCode}
              </p>
              {order.shippingMethod && (
                <p className="mt-3 text-xs text-slate-500">
                  {order.shippingMethod.name} ·{' '}
                  {t('etaDays', { days: order.shippingMethod.estimatedDays })}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">—</p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            {t('payment')}
          </h2>
          {payment ? (
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{tPayment('status')}</span>
                <StatusBadge status={payment.status} variant="order" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{t('provider')}</span>
                <span className="font-medium text-slate-900">
                  {payment.provider}
                </span>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              {tPayment('awaitingPaymentTitle')}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  valueClass
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`font-medium text-slate-900 ${valueClass ?? ''}`}>
        {value}
      </dd>
    </div>
  );
}
