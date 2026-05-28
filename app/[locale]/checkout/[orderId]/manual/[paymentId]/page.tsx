import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { ManualPaymentClient } from '@/components/checkout/ManualPaymentClient';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

type Props = {
  params: Promise<{ locale: string; orderId: string; paymentId: string }>;
};

export default async function ManualPaymentPage({ params }: Props) {
  const { locale, orderId, paymentId } = await params;
  const t = await getTranslations({ locale, namespace: 'payment' });

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/login?from=/${locale}/checkout/${orderId}/manual/${paymentId}`);
  }

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      order: { select: { id: true, userId: true, status: true } }
    }
  });
  if (!payment) notFound();
  if (payment.orderId !== orderId) notFound();
  if (user.role !== 'ADMIN' && payment.order.userId !== user.id) notFound();

  const code = payment.method;
  if (code !== 'CARD_TRANSFER' && code !== 'BANK_TRANSFER') {
    // Not a manual payment → bounce to the regular pay step.
    redirect(`/${locale}/checkout/${orderId}/pay`);
  }

  if (payment.order.status === 'PAID') {
    redirect(`/${locale}/orders/${orderId}`);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {t('manualTitle')}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{t('manualSubtitle')}</p>
      </header>
      <ManualPaymentClient
        paymentId={payment.id}
        methodCode={code}
        orderId={orderId}
        locale={locale}
        amount={Number(payment.amount)}
        currency={payment.currency}
        initialReference={payment.referenceNumber}
        initialReceipt={payment.receiptImage}
      />
    </div>
  );
}
