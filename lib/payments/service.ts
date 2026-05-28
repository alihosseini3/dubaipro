import { prisma } from '@/lib/prisma';
import { getMethod } from './methods';
import { dispatchCreateIntent, getProvider } from './registry';
import {
  PaymentError,
  type CreateIntentResult,
  type PaymentOutcome
} from './types';

/**
 * Thin orchestration layer that sits between API routes and providers.
 *
 * Responsibilities:
 *   - always re-read the authoritative amount from the Order row
 *     (never trust client-supplied totals)
 *   - create a Payment row BEFORE calling the gateway so every intent
 *     has a persistent correlation id we can show in admin
 *   - normalize webhook events and update the Payment + Order together
 */

export type CheckoutRequest = {
  orderId: string;
  /**
   * Either a method code (e.g. "MELLAT") from `methods.ts` OR a raw
   * provider name (e.g. "stripe") for backward compatibility with the
   * pre-catalog API.
   */
  provider: string;
  userId: string;
  isAdmin: boolean;
  /** Absolute origin, e.g. `https://foo.com` */
  baseUrl: string;
  locale: string;
};

export async function startCheckout(
  req: CheckoutRequest
): Promise<CreateIntentResult> {
  const order = await prisma.order.findUnique({
    where: { id: req.orderId },
    include: { user: { select: { email: true } } }
  });
  if (!order) {
    throw new PaymentError('order_not_found', 404);
  }

  if (!req.isAdmin && order.userId !== req.userId) {
    throw new PaymentError('order_not_payable', 403);
  }

  if (order.status !== 'PENDING') {
    throw new PaymentError(
      'order_not_payable',
      409,
      `Order status is ${order.status}`
    );
  }

  // Shipping + address are mandatory before payment. The checkout UI
  // enforces this via step ordering; the API enforces it again so that
  // a direct POST cannot skip the steps.
  if (!order.addressId) {
    throw new PaymentError('order_not_payable', 409, 'address_required');
  }
  if (!order.shippingMethodId) {
    throw new PaymentError('order_not_payable', 409, 'shipping_required');
  }

  // Resolve method code → provider. If the caller passed a raw provider
  // name (legacy callers), `methodDef` is null and we just use it as-is.
  const methodDef = await getMethod(req.provider);
  const providerName = methodDef ? methodDef.provider : req.provider;
  const methodCode = methodDef ? methodDef.code : null;

  // Ensure provider is valid before we touch the DB.
  getProvider(providerName);

  const amount = Number(order.totalPrice);
  const successUrl = `${req.baseUrl}/${req.locale}/orders/${order.id}`;
  const cancelUrl = `${req.baseUrl}/${req.locale}/checkout/${order.id}?cancelled=1`;

  const payment = await prisma.payment.create({
    data: {
      orderId: order.id,
      amount: order.totalPrice,
      currency: 'USD', // set below once we read items
      provider: providerName,
      method: methodCode,
      status: 'PENDING'
    }
  });

  // Currency comes from the first item of the order — there is no
  // per-order currency column in the current schema. We normalize here
  // so the gateway sees a single currency.
  const firstItem = await prisma.orderItem.findFirst({
    where: { orderId: order.id },
    include: { product: { select: { currency: true } } }
  });
  const currency = firstItem?.product.currency ?? 'USD';

  await prisma.payment.update({
    where: { id: payment.id },
    data: { currency }
  });

  try {
    const result = await dispatchCreateIntent(
      providerName,
      {
        id: order.id,
        amount,
        currency,
        customerEmail: order.user?.email ?? null,
        description: `Order #${order.id.slice(-8).toUpperCase()}`,
        successUrl,
        cancelUrl
      },
      payment.id
    );

    // Manual transfers wait for receipt → MANUAL_REVIEW.
    // Hosted gateways → PROCESSING until webhook lands.
    const nextStatus =
      methodDef?.kind === 'manual' ? 'MANUAL_REVIEW' : 'PROCESSING';
    await prisma.payment.update({
      where: { id: payment.id },
      data: { providerId: result.providerId, status: nextStatus }
    });
    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentMethod: methodCode ?? providerName,
        paymentStatus: nextStatus
      }
    });

    return result;
  } catch (err) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
        errorMessage: err instanceof Error ? err.message : 'unknown error'
      }
    });
    throw err;
  }
}

/**
 * Apply a normalized payment outcome. Idempotent — re-delivering the
 * same event is a no-op after the first successful apply.
 */
export async function applyPaymentOutcome(
  outcome: PaymentOutcome
): Promise<void> {
  const payment = await prisma.payment.findUnique({
    where: { providerId: outcome.providerId }
  });
  if (!payment) {
    // Unknown providerId. Log and drop — do NOT create rows from webhook
    // input to avoid attackers seeding fake payments.
    console.warn(
      '[payments] outcome for unknown providerId:',
      outcome.providerId
    );
    return;
  }

  // Idempotency: don't regress terminal states.
  if (payment.status === 'PAID' || payment.status === 'REFUNDED') return;

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: outcome.status,
        errorMessage: outcome.errorMessage ?? null
      }
    });

    if (outcome.status === 'PAID') {
      await tx.order.update({
        where: { id: payment.orderId },
        data: {
          status: 'PAID',
          paymentStatus: 'PAID',
          paidAt: new Date()
        }
      });
    } else if (outcome.status === 'FAILED') {
      await tx.order.update({
        where: { id: payment.orderId },
        data: { paymentStatus: 'FAILED' }
      });
    }
  });

  if (outcome.status === 'PAID') {
    // Outside the tx so a commission failure can never roll back the
    // order. The commission helper is idempotent (unique on orderId)
    // so webhook retries are safe.
    const { recordCommissionForOrder } = await import(
      '@/lib/referral/commission'
    );
    void recordCommissionForOrder(payment.orderId);

    // Best-effort lifecycle hook: refresh user metrics + maybe fire
    // a FIRST_PURCHASE_UPSELL event. Fully fire-and-forget so a slow
    // automation dispatch can't delay the webhook ACK.
    void onPaidOrderLifecycle(payment.orderId);

    // Server-side ad-network conversions (Meta CAPI + GA4 MP). Reuses
    // the same orderId as event_id so it deduplicates against the
    // client pixel that already fired in `<TrackEvent event="purchase">`.
    void onPaidOrderServerTracking(payment.orderId);
  }
}

/**
 * Send the purchase to Meta CAPI and GA4 Measurement Protocol. Pulls
 * order data fresh from the DB so we don't trust webhook input.
 */
async function onPaidOrderServerTracking(orderId: string): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        totalPrice: true,
        items: { select: { productId: true, quantity: true, price: true } }
      }
    });
    if (!order) return;

    const { trackServerPurchase } = await import('@/lib/marketing/server-tracking');
    await trackServerPurchase({
      orderId: order.id,
      userId: order.userId,
      value: Number(order.totalPrice),
      currency: 'AED',
      items: order.items.map((i) => ({
        id: i.productId,
        quantity: i.quantity,
        price: Number(i.price)
      }))
    });
  } catch (err) {
    console.warn('[server-tracking] hook failed:', err);
  }
}

/**
 * After an order transitions to PAID, refresh the customer's
 * denormalized metrics and (if this was their first paid order)
 * dispatch the upsell automation event. Errors are swallowed — the
 * order is already paid and tracked, lifecycle is a side-channel.
 */
async function onPaidOrderLifecycle(orderId: string): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        userId: true,
        totalPrice: true,
        user: { select: { name: true, email: true } }
      }
    });
    if (!order) return;

    const { recomputeUserMetrics } = await import('@/lib/customers/metrics');
    const metrics = await recomputeUserMetrics(order.userId);
    if (!metrics) return;

    if (metrics.isFirstPurchase) {
      const [{ dispatchAutomation }, { buildPersonalVars }] = await Promise.all([
        import('@/lib/automation/dispatch'),
        import('@/lib/automation/personalize')
      ]);
      const personal = await buildPersonalVars(order.userId);
      await dispatchAutomation({
        eventType: 'FIRST_PURCHASE_UPSELL',
        userId: order.userId,
        dedupeKey: `FIRST_PURCHASE_UPSELL:${orderId}`,
        email: order.user.email,
        vars: {
          name: order.user.name,
          price: Number(order.totalPrice).toFixed(2),
          link: `/account/orders/${orderId}`,
          ...personal
        }
      });
      await prisma.userMetrics
        .update({
          where: { userId: order.userId },
          data: { upsellAt: new Date() }
        })
        .catch(() => null);
    }
  } catch (err) {
    console.warn('[lifecycle] onPaidOrderLifecycle failed:', err);
  }
}

// =============== Manual-payment helpers =================================

/**
 * User submits a tracking reference / receipt image for a manual
 * transfer. Status moves to MANUAL_REVIEW so admins can approve.
 */
export async function submitManualPayment(args: {
  paymentId: string;
  userId: string;
  isAdmin: boolean;
  referenceNumber?: string | null;
  receiptImage?: string | null;
}) {
  const payment = await prisma.payment.findUnique({
    where: { id: args.paymentId },
    include: { order: { select: { userId: true, status: true } } }
  });
  if (!payment) throw new PaymentError('order_not_found', 404);
  if (!args.isAdmin && payment.order.userId !== args.userId) {
    throw new PaymentError('order_not_payable', 403);
  }
  if (payment.status === 'PAID' || payment.status === 'REFUNDED') {
    throw new PaymentError('order_not_payable', 409, 'already_terminal');
  }
  if (
    !args.referenceNumber?.trim() &&
    !args.receiptImage?.trim()
  ) {
    throw new PaymentError(
      'order_not_payable',
      400,
      'reference_or_receipt_required'
    );
  }
  return prisma.payment.update({
    where: { id: payment.id },
    data: {
      referenceNumber: args.referenceNumber?.trim() || null,
      receiptImage: args.receiptImage?.trim() || null,
      status: 'MANUAL_REVIEW'
    }
  });
}

/** Admin approves a payment → mark Payment + Order as PAID. */
export async function adminApprovePayment(paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId }
  });
  if (!payment) throw new PaymentError('order_not_found', 404);
  if (payment.status === 'PAID') return payment;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.payment.update({
      where: { id: payment.id },
      data: { status: 'PAID', errorMessage: null }
    });
    await tx.order.update({
      where: { id: payment.orderId },
      data: {
        status: 'PAID',
        paymentStatus: 'PAID',
        paidAt: new Date()
      }
    });
    // Best-effort: record affiliate commission. Idempotent on retry.
    const { recordCommissionForOrder } = await import(
      '@/lib/referral/commission'
    );
    void recordCommissionForOrder(payment.orderId);
    return updated;
  });
}

/** Admin rejects a payment → mark Payment as FAILED with reason. */
export async function adminRejectPayment(
  paymentId: string,
  reason: string
) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId }
  });
  if (!payment) throw new PaymentError('order_not_found', 404);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.payment.update({
      where: { id: payment.id },
      data: { status: 'FAILED', errorMessage: reason || 'rejected' }
    });
    await tx.order.update({
      where: { id: payment.orderId },
      data: { paymentStatus: 'FAILED' }
    });
    return updated;
  });
}
