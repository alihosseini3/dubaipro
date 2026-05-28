import { notFound, redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

type Props = { params: Promise<{ locale: string; orderId: string }> };

/**
 * Checkout hub — routes the user to the correct step based on order state:
 *   - No address  → /address
 *   - No shipping → /shipping
 *   - Both set    → /pay
 *   - PAID        → /orders/[id] (receipt)
 *
 * Having a single canonical URL makes "Checkout" buttons portable across
 * the app; the rest of the flow is in child routes.
 */
export default async function CheckoutHubPage({ params }: Props) {
  const { locale, orderId } = await params;

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/login?from=/${locale}/checkout/${orderId}`);
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      userId: true,
      status: true,
      addressId: true,
      shippingMethodId: true
    }
  });

  if (!order) notFound();
  if (user.role !== 'ADMIN' && order.userId !== user.id) notFound();

  if (order.status === 'PAID') {
    redirect(`/${locale}/orders/${order.id}`);
  }

  if (!order.addressId) {
    redirect(`/${locale}/checkout/${order.id}/address`);
  }
  if (!order.shippingMethodId) {
    redirect(`/${locale}/checkout/${order.id}/shipping`);
  }
  redirect(`/${locale}/checkout/${order.id}/pay`);
}
