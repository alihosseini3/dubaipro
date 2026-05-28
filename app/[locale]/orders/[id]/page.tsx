import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { StatusBadge } from '@/components/admin/StatusBadge';
import { getDisplayCurrency } from '@/lib/currency/context';
import { formatDisplayFromAED } from '@/lib/currency/service';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function OrderDetailPage({ params }: Props) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: 'orders' });

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/login?from=/${locale}/orders/${id}`);
  }

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
      payments: { orderBy: { createdAt: 'desc' }, take: 1 }
    }
  });

  if (!order) notFound();
  if (user.role !== 'ADMIN' && order.userId !== user.id) notFound();

  const display = await getDisplayCurrency(locale);
  const fmt = (amountAED: number) => formatDisplayFromAED(amountAED, display);
  const total = fmt(Number(order.totalPrice));
  const latestPayment = order.payments[0];
  const isPaid = order.status === 'PAID';
  const tPayment = await getTranslations({ locale, namespace: 'payment' });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div
        className={
          'rounded-2xl border p-6 shadow-sm ' +
          (isPaid
            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
            : 'border-amber-200 bg-amber-50 text-amber-900')
        }
      >
        <div className="flex items-start gap-3">
          <div
            className={
              'flex h-10 w-10 flex-none items-center justify-center rounded-full text-white ' +
              (isPaid ? 'bg-emerald-500' : 'bg-amber-500')
            }
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              {isPaid ? (
                <path d="M5 13l4 4L19 7" />
              ) : (
                <>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4m0 4h.01" />
                </>
              )}
            </svg>
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold">
              {isPaid ? t('successTitle') : tPayment('awaitingPaymentTitle')}
            </h1>
            <p className="mt-1 text-sm opacity-80">
              {isPaid
                ? t('successMessage', { id: order.id.slice(-8).toUpperCase() })
                : tPayment('awaitingPaymentMessage')}
            </p>
            {!isPaid && (
              <Link
                href={`/${locale}/checkout/${order.id}`}
                className="mt-3 inline-flex items-center rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700"
              >
                {tPayment('payNow')}
              </Link>
            )}
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">
              {t('orderNumber')}
            </div>
            <div className="mt-1 font-mono text-sm font-semibold text-slate-900">
              {order.id}
            </div>
          </div>
          <StatusBadge status={order.status} variant="order" />
        </div>

        {latestPayment && (
          <div className="mt-4 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
            <span className="text-slate-500">
              {tPayment('status')} · {latestPayment.provider}
            </span>
            <StatusBadge status={latestPayment.status} variant="order" />
          </div>
        )}

        <ul className="mt-5 divide-y divide-slate-100">
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
                  <div className="mt-1 text-xs text-slate-500">
                    {t('qty')}: {item.quantity}
                  </div>
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  {fmt(Number(item.price) * item.quantity)}
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-baseline justify-between border-t border-slate-200 pt-4">
          <span className="text-sm font-semibold text-slate-700">
            {t('total')}
          </span>
          <span className="text-2xl font-bold text-slate-900">{total}</span>
        </div>
      </section>

      <div className="flex gap-3">
        <Link
          href={`/${locale}/products`}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-900"
        >
          {t('continueShopping')}
        </Link>
      </div>
    </div>
  );
}
