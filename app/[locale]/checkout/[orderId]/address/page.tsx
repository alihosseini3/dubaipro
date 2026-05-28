import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { AddressStepClient } from '@/components/checkout/AddressStepClient';
import { CheckoutStepper } from '@/components/checkout/CheckoutStepper';
import { CheckoutSummary } from '@/components/checkout/CheckoutSummary';
import { listAddressesForUser } from '@/lib/address/service';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

type Props = { params: Promise<{ locale: string; orderId: string }> };

export default async function CheckoutAddressPage({ params }: Props) {
  const { locale, orderId } = await params;
  const t = await getTranslations({ locale, namespace: 'checkout' });

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/login?from=/${locale}/checkout/${orderId}/address`);
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

  const addresses = await listAddressesForUser(order.userId);
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
        <p className="mt-1 text-sm text-slate-500">{t('subtitleAddress')}</p>
      </header>

      <CheckoutStepper
        current="address"
        orderId={order.id}
        locale={locale}
        completed={{
          address: Boolean(order.addressId),
          shipping: Boolean(order.shippingMethodId)
        }}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="lg:col-span-7">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              {t('addressHeading')}
            </h2>
            <AddressStepClient
              orderId={order.id}
              locale={locale}
              initialAddresses={addresses}
              initialSelectedId={order.addressId}
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
