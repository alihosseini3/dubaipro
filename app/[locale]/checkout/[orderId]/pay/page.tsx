import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { CheckoutStepper } from '@/components/checkout/CheckoutStepper';
import { CheckoutSummary } from '@/components/checkout/CheckoutSummary';
import { PaymentMethodPicker } from '@/components/checkout/PaymentMethodPicker';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

type Props = {
  params: Promise<{ locale: string; orderId: string }>;
  searchParams: Promise<{ cancelled?: string }>;
};

export default async function CheckoutPayPage({ params, searchParams }: Props) {
  const { locale, orderId } = await params;
  const { cancelled } = await searchParams;
  const t = await getTranslations({ locale, namespace: 'checkout' });
  const tp = await getTranslations({ locale, namespace: 'payment' });

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/login?from=/${locale}/checkout/${orderId}/pay`);
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: {
            select: { id: true, title: true, slug: true, imageUrl: true, currency: true }
          }
        }
      },
      address: true,
      shippingMethod: true
    }
  });

  if (!order) notFound();
  if (user.role !== 'ADMIN' && order.userId !== user.id) notFound();

  if (order.status === 'PAID') {
    redirect(`/${locale}/orders/${order.id}`);
  }

  // Payment step requires both address + shipping. If either is missing,
  // bounce the user back to the earliest incomplete step.
  if (!order.addressId || !order.address) {
    redirect(`/${locale}/checkout/${order.id}/address`);
  }
  if (!order.shippingMethodId || !order.shippingMethod) {
    redirect(`/${locale}/checkout/${order.id}/shipping`);
  }

  const currency = order.items[0]?.product.currency ?? 'USD';
  const itemsTotal = order.items.reduce(
    (sum, it) => sum + Number(it.price) * it.quantity,
    0
  );
  const shippingPrice = Number(order.shippingPrice);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{t('subtitlePay')}</p>
      </header>

      <CheckoutStepper
        current="pay"
        orderId={order.id}
        locale={locale}
        completed={{ address: true, shipping: true }}
      />

      {cancelled && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <svg
            viewBox="0 0 24 24"
            className="mt-0.5 h-5 w-5 flex-none"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4m0 4h.01" />
          </svg>
          <div>
            <p className="font-semibold">{tp('cancelledTitle')}</p>
            <p className="mt-0.5 text-amber-800/80">{tp('cancelledMessage')}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="lg:col-span-7 space-y-4">
          <InfoCard title={t('shippingTo')}>
            <p className="text-sm font-semibold text-slate-900">
              {order.address.fullName}
            </p>
            <p className="text-xs text-slate-600">
              {order.address.addressLine}, {order.address.city},{' '}
              {order.address.country} · {order.address.postalCode}
            </p>
            <p className="text-xs text-slate-500">{order.address.phone}</p>
          </InfoCard>

          <InfoCard title={t('shippingMethod')}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {order.shippingMethod.name}
                </p>
                {order.shippingMethod.description && (
                  <p className="mt-0.5 text-xs text-slate-500">
                    {order.shippingMethod.description}
                  </p>
                )}
              </div>
              <div className="text-sm font-semibold text-slate-900">
                {shippingPrice.toFixed(2)}{' '}
                <span className="text-xs font-medium text-slate-500">
                  {currency}
                </span>
              </div>
            </div>
          </InfoCard>
        </section>

        <aside className="lg:col-span-5">
          <div className="space-y-4">
            <CheckoutSummary
              locale={locale}
              items={order.items.map((it) => ({
                id: it.id,
                title: it.product?.title ?? '—',
                slug: it.product?.slug ?? null,
                imageUrl: it.product?.imageUrl ?? null,
                price: Number(it.price),
                quantity: it.quantity
              }))}
              itemsTotal={itemsTotal}
              shippingPrice={shippingPrice}
              discountAmount={Number(order.discountAmount ?? 0)}
              couponCode={order.couponCode}
              currency={currency}
              shippingLabel={order.shippingMethod.name}
            />

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">
                {tp('chooseMethod')}
              </h3>
              <PaymentMethodPicker
                orderId={order.id}
                locale={locale}
                country={order.address.country}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function InfoCard({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h2>
      {children}
    </div>
  );
}

