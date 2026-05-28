import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { CheckoutStepper } from '@/components/checkout/CheckoutStepper';
import { CheckoutSummary } from '@/components/checkout/CheckoutSummary';
import { ShippingStepClient } from '@/components/checkout/ShippingStepClient';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { listMethodsForCountry } from '@/lib/shipping/service';
import { getDisplayCurrency } from '@/lib/currency/context';

type Props = {
  params: Promise<{ locale: string; orderId: string }>;
  searchParams: Promise<{ addressId?: string }>;
};

export default async function CheckoutShippingPage({
  params,
  searchParams
}: Props) {
  const { locale, orderId } = await params;
  const { addressId: addressIdQuery } = await searchParams;
  const t = await getTranslations({ locale, namespace: 'checkout' });

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/login?from=/${locale}/checkout/${orderId}/shipping`);
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
      }
    }
  });

  if (!order) notFound();
  if (user.role !== 'ADMIN' && order.userId !== user.id) notFound();
  if (order.status === 'PAID') {
    redirect(`/${locale}/orders/${order.id}`);
  }

  // Address must be set (either already saved on the order, or passed via
  // query param from the previous step). The server re-verifies below.
  const addressId = addressIdQuery ?? order.addressId;
  if (!addressId) {
    redirect(`/${locale}/checkout/${order.id}/address`);
  }
  const address = await prisma.address.findFirst({
    where: { id: addressId, userId: order.userId }
  });
  if (!address) {
    redirect(`/${locale}/checkout/${order.id}/address`);
  }

  // Country resolves the shipping zone, which gates which methods the
  // customer is allowed to pick. Methods with no zone act as a global
  // fallback so legacy data keeps working.
  const methods = await listMethodsForCountry(address.country);
  const currency = order.items[0]?.product.currency ?? 'USD';
  const itemsTotal = order.items.reduce(
    (sum, it) => sum + Number(it.price) * it.quantity,
    0
  );

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{t('subtitleShipping')}</p>
      </header>

      <CheckoutStepper
        current="shipping"
        orderId={order.id}
        locale={locale}
        completed={{
          address: true,
          shipping: Boolean(order.shippingMethodId)
        }}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="lg:col-span-7 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  {t('shippingTo')}
                </h2>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {address.fullName}
                </p>
                <p className="text-xs text-slate-600">
                  {address.addressLine}, {address.city}, {address.country}{' '}
                  · {address.postalCode}
                </p>
                <p className="text-xs text-slate-500">{address.phone}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              {t('chooseShipping')}
            </h2>
            <ShippingStepClient
              orderId={order.id}
              locale={locale}
              currency={currency}
              display={await getDisplayCurrency(locale)}
              addressId={address.id}
              methods={methods}
              initialSelectedId={order.shippingMethodId ?? null}
            />
          </div>
        </section>

        <aside className="lg:col-span-5">
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
            shippingPrice={Number(order.shippingPrice ?? 0)}
            discountAmount={Number(order.discountAmount ?? 0)}
            couponCode={order.couponCode}
            currency={currency}
          />
        </aside>
      </div>
    </div>
  );
}
