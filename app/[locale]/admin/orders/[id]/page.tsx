import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { AdminCard } from '@/components/admin/AdminCard';
import { OrderStatusForm } from '@/components/admin/OrderStatusForm';
import { PaymentPanel } from '@/components/admin/PaymentPanel';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { Price } from '@/components/currency/Price';
import { OrderTimeline } from '@/components/orders/OrderTimeline';
import { requireAdmin } from '@/lib/auth/require-admin';
import { prisma } from '@/lib/prisma';

type Props = { params: Promise<{ locale: string; id: string }> };

function formatDateTime(d: Date): string {
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

export default async function AdminOrderDetailPage({ params }: Props) {
  const { locale, id } = await params;
  await requireAdmin(locale, `/${locale}/admin/orders/${id}`);

  const t = await getTranslations({ locale, namespace: 'admin.orders' });

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      address: true,
      shippingMethod: true,
      items: {
        include: {
          product: {
            select: { id: true, title: true, slug: true, imageUrl: true }
          }
        }
      },
      payments: { orderBy: { createdAt: 'desc' } }
    }
  });

  if (!order) notFound();

  // Totals in AED (the canonical storage unit). The <Price> component
  // converts + formats for the active locale at render time.
  const shortId = order.id.slice(-8).toUpperCase();
  const shipping = Number(order.shippingPrice);
  const discount = Number(order.discountAmount);
  const total = Number(order.totalPrice);
  const subtotal = order.items.reduce(
    (sum, i) => sum + Number(i.price) * i.quantity,
    0
  );
  const latestPayment = order.payments[0];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href={`/${locale}/admin/orders`}
            className="text-xs text-slate-500 transition-colors hover:text-slate-900"
          >
            ← {t('backToList')}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            {t('orderTitle', { id: shortId })}
          </h1>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {formatDateTime(order.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={order.status} variant="order" />
          {latestPayment && (
            <StatusBadge status={latestPayment.status} variant="neutral" />
          )}
        </div>
      </header>

      <OrderTimeline
        locale={locale}
        status={order.status}
        updatedAt={order.updatedAt}
        trackingCode={order.trackingCode}
        carrier={order.carrier}
        shippingMethodName={order.shippingMethod?.name ?? null}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ================= Invoice body ================= */}
        <div className="space-y-4 lg:col-span-2">
          <AdminCard className="print:shadow-none">
            {/* Invoice header: from / to blocks */}
            <div className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-100 pb-5">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  {t('invoiceTitle')}
                </h2>
                <div className="mt-2 space-y-0.5 text-xs text-slate-500 tabular-nums">
                  <div>
                    <span className="font-semibold text-slate-700">
                      {t('invoiceOrderNumber')}:
                    </span>{' '}
                    #{shortId}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">
                      {t('invoiceDate')}:
                    </span>{' '}
                    {formatDateTime(order.createdAt)}
                  </div>
                </div>
              </div>

              {/* "Bill to" — buyer identity */}
              <div className="min-w-[180px]">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t('billTo')}
                </p>
                <div className="mt-1 text-sm">
                  <p className="font-semibold text-slate-900">
                    {order.user?.name ?? '—'}
                  </p>
                  <p className="font-mono text-xs text-slate-600">
                    {order.user?.email ?? '—'}
                  </p>
                  {order.user && (
                    <Link
                      href={`/${locale}/admin/users/${order.user.id}`}
                      className="mt-1 inline-block text-xs font-semibold text-slate-900 underline-offset-2 hover:underline"
                    >
                      {t('viewCustomer')} →
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* "Ship to" / shipping method — side by side */}
            <div className="grid grid-cols-1 gap-4 border-b border-slate-100 py-5 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t('shipTo')}
                </p>
                {order.address ? (
                  <div className="mt-1 space-y-0.5 text-sm text-slate-700">
                    <p className="font-semibold text-slate-900">
                      {order.address.fullName}
                    </p>
                    <p>{order.address.addressLine}</p>
                    <p>
                      {order.address.city}, {order.address.country}
                    </p>
                    <p className="font-mono text-xs">
                      {order.address.postalCode} · {order.address.phone}
                    </p>
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-slate-500">{t('noAddress')}</p>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t('shippingMethodTitle')}
                </p>
                {order.shippingMethod ? (
                  <div className="mt-1 space-y-0.5 text-sm text-slate-700">
                    <p className="font-semibold text-slate-900">
                      {order.shippingMethod.name}
                    </p>
                    {order.shippingMethod.description && (
                      <p className="text-xs text-slate-500">
                        {order.shippingMethod.description}
                      </p>
                    )}
                    <p className="text-xs text-slate-500">
                      {order.shippingMethod.estimatedDays}d
                    </p>
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-slate-500">
                    {t('noShippingMethod')}
                  </p>
                )}
              </div>
            </div>

            {/* Line items table */}
            <div className="overflow-x-auto pt-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="py-2">{t('itemColProduct')}</th>
                    <th className="py-2 text-center">{t('itemColQty')}</th>
                    <th className="py-2 text-right">{t('itemColPrice')}</th>
                    <th className="py-2 text-right">{t('itemColSubtotal')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 flex-none overflow-hidden rounded-lg bg-slate-100">
                            {item.product?.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.product.imageUrl}
                                alt={item.product.title}
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </div>
                          <Link
                            href={`/${locale}/products/${item.product?.slug ?? ''}`}
                            className="text-sm font-medium text-slate-900 hover:underline"
                          >
                            {item.product?.title ?? '—'}
                          </Link>
                        </div>
                      </td>
                      <td className="py-3 text-center tabular-nums text-slate-700">
                        {item.quantity}
                      </td>
                      <td className="py-3 text-right tabular-nums text-slate-700">
                        <Price amount={Number(item.price)} locale={locale} />
                      </td>
                      <td className="py-3 text-right font-semibold tabular-nums text-slate-900">
                        <Price
                          amount={Number(item.price) * item.quantity}
                          locale={locale}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals breakdown */}
            <div className="mt-5 flex justify-end">
              <dl className="w-full max-w-xs space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">{t('summarySubtotal')}</dt>
                  <dd className="tabular-nums text-slate-700">
                    <Price amount={subtotal} locale={locale} />
                  </dd>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-slate-500">
                      {order.couponCode
                        ? t('summaryCoupon', { code: order.couponCode })
                        : t('summaryDiscount')}
                    </dt>
                    <dd className="tabular-nums text-emerald-700">
                      −<Price amount={discount} locale={locale} />
                    </dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-slate-500">{t('summaryShipping')}</dt>
                  <dd className="tabular-nums text-slate-700">
                    <Price amount={shipping} locale={locale} />
                  </dd>
                </div>
                <div className="flex items-baseline justify-between border-t border-slate-200 pt-2">
                  <dt className="font-semibold text-slate-900">
                    {t('summaryTotal')}
                  </dt>
                  <dd className="text-xl font-bold tabular-nums text-slate-900">
                    <Price amount={total} locale={locale} />
                  </dd>
                </div>
              </dl>
            </div>
          </AdminCard>
        </div>

        {/* ================= Side panel ================= */}
        <aside className="space-y-4">
          <AdminCard title={t('statusTitle')}>
            <OrderStatusForm
              orderId={order.id}
              currentStatus={order.status}
              currentTrackingCode={order.trackingCode}
              currentCarrier={order.carrier}
            />
          </AdminCard>

          <PaymentPanel payments={order.payments} locale={locale} />
        </aside>
      </div>
    </div>
  );
}
