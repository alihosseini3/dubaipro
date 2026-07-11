import 'server-only';

import { PaymentStatus, Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { getMethod, getManualAccountInfo } from '@/lib/payments/methods';
import { getProvider, dispatchCreateIntent } from '@/lib/payments/registry';
import { PaymentError, type PaymentOutcome } from '@/lib/payments/types';

import { activatePlan, FREE_PLAN_CODE, SubscriptionError } from './service';

/**
 * Paid subscription checkout — reuses the ENTIRE modular payment stack
 * (method catalog, provider registry, shared gateway webhook) but writes to
 * its own `SubscriptionInvoice` table: `Payment` is order-coupled and its
 * outcome handler ships orders, while a paid invoice activates a plan.
 *
 * Flow:
 *   hosted gateway : checkout → PROCESSING → webhook PAID → activatePlan
 *   manual transfer: checkout → MANUAL_REVIEW → supplier submits reference
 *                    → admin approves → activatePlan
 */

const INVOICE_SELECT = {
  id: true,
  supplierId: true,
  planId: true,
  periodMonths: true,
  amount: true,
  currency: true,
  status: true,
  provider: true,
  method: true,
  referenceNumber: true,
  activatedAt: true,
  createdAt: true,
  plan: { select: { code: true, nameTranslations: true } },
  supplier: { select: { id: true, name: true } }
} satisfies Prisma.SubscriptionInvoiceSelect;

export type SubscriptionCheckoutResult = {
  invoiceId: string;
  kind: 'redirect' | 'embedded' | 'manual';
  redirectUrl?: string;
  clientSecret?: string;
  /** Bank/card details the supplier should transfer to (manual kind). */
  manualInfo?: Awaited<ReturnType<typeof getManualAccountInfo>>;
};

export async function startSubscriptionCheckout(params: {
  supplierId: string;
  userId: string;
  userEmail: string;
  planId: string;
  /** Method code from the payment catalog (e.g. STRIPE, BANK_TRANSFER). */
  method: string;
  baseUrl: string;
  locale: string;
}): Promise<SubscriptionCheckoutResult> {
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id: params.planId },
    select: {
      id: true,
      code: true,
      price: true,
      currency: true,
      intervalMonths: true,
      isActive: true
    }
  });
  if (!plan || !plan.isActive) throw new SubscriptionError('Plan not found', 404);
  if (plan.code === FREE_PLAN_CODE || Number(plan.price) <= 0) {
    throw new SubscriptionError('This plan does not require payment', 400);
  }

  const methodDef = await getMethod(params.method);
  if (!methodDef || !methodDef.enabled) {
    throw new PaymentError('provider_misconfigured', 400, 'unknown_method');
  }
  getProvider(methodDef.provider); // throws early when misconfigured

  const invoice = await prisma.subscriptionInvoice.create({
    data: {
      supplierId: params.supplierId,
      planId: plan.id,
      periodMonths: plan.intervalMonths,
      amount: plan.price,
      currency: plan.currency,
      provider: methodDef.provider,
      method: methodDef.code,
      createdById: params.userId
    },
    select: { id: true }
  });

  const successUrl = `${params.baseUrl}/${params.locale}/supplier/subscription?paid=1`;
  const cancelUrl = `${params.baseUrl}/${params.locale}/supplier/subscription?cancelled=1`;

  try {
    const result = await dispatchCreateIntent(
      methodDef.provider,
      {
        id: invoice.id,
        amount: Number(plan.price),
        currency: plan.currency,
        customerEmail: params.userEmail,
        description: `DubaiPro ${plan.code} subscription (${plan.intervalMonths} months)`,
        successUrl,
        cancelUrl
      },
      invoice.id
    );

    await prisma.subscriptionInvoice.update({
      where: { id: invoice.id },
      data: {
        providerId: result.providerId,
        status:
          methodDef.kind === 'manual'
            ? PaymentStatus.MANUAL_REVIEW
            : PaymentStatus.PROCESSING
      }
    });

    return {
      invoiceId: invoice.id,
      kind: methodDef.kind,
      // The manual provider's redirectUrl targets the ORDER checkout flow —
      // subscriptions render the transfer instructions inline instead.
      redirectUrl: methodDef.kind === 'manual' ? undefined : result.redirectUrl,
      clientSecret: result.clientSecret,
      manualInfo:
        methodDef.kind === 'manual'
          ? // kind === 'manual' implies one of the two transfer codes.
            await getManualAccountInfo(
              methodDef.code as 'CARD_TRANSFER' | 'BANK_TRANSFER'
            )
          : undefined
    };
  } catch (err) {
    await prisma.subscriptionInvoice.update({
      where: { id: invoice.id },
      data: {
        status: PaymentStatus.FAILED,
        errorMessage: err instanceof Error ? err.message : 'unknown error'
      }
    });
    throw err;
  }
}

/** Supplier attaches the bank-transfer tracking number to a manual invoice. */
export async function submitInvoiceReference(
  supplierId: string,
  invoiceId: string,
  referenceNumber: string
) {
  const { count } = await prisma.subscriptionInvoice.updateMany({
    where: {
      id: invoiceId,
      supplierId,
      status: PaymentStatus.MANUAL_REVIEW
    },
    data: { referenceNumber: referenceNumber.slice(0, 128) }
  });
  if (count === 0) throw new SubscriptionError('Invoice not found', 404);
}

/**
 * Activate the plan for a PAID invoice — the single idempotency gate for
 * webhook retries AND admin approvals (`activatedAt` latch).
 */
async function activateInvoice(invoiceId: string): Promise<void> {
  const { count } = await prisma.subscriptionInvoice.updateMany({
    where: { id: invoiceId, activatedAt: null },
    data: { status: PaymentStatus.PAID, activatedAt: new Date() }
  });
  if (count === 0) return; // already activated (retry / double click)

  const invoice = await prisma.subscriptionInvoice.findUnique({
    where: { id: invoiceId },
    select: { supplierId: true, planId: true, periodMonths: true }
  });
  if (!invoice) return;

  await activatePlan({
    supplierId: invoice.supplierId,
    planId: invoice.planId,
    periodMonths: invoice.periodMonths,
    assignedById: null
  });
}

/**
 * Webhook counterpart of applyPaymentOutcome for subscription invoices.
 * Called by the shared gateway webhook when the providerId belongs to an
 * invoice instead of an order payment.
 */
export async function applySubscriptionOutcome(
  outcome: PaymentOutcome
): Promise<boolean> {
  const invoice = await prisma.subscriptionInvoice.findUnique({
    where: { providerId: outcome.providerId },
    select: { id: true, status: true }
  });
  if (!invoice) return false;

  if (invoice.status === PaymentStatus.PAID) return true; // idempotent

  if (outcome.status === 'PAID') {
    await activateInvoice(invoice.id);
  } else {
    await prisma.subscriptionInvoice.update({
      where: { id: invoice.id },
      data: {
        status: outcome.status,
        errorMessage: outcome.errorMessage ?? null
      }
    });
  }
  return true;
}

/* ─── Admin review of manual invoices ────────────────────────────────────── */

export async function listInvoices(params: {
  status?: PaymentStatus;
  page: number;
  pageSize: number;
}) {
  const where: Prisma.SubscriptionInvoiceWhereInput = params.status
    ? { status: params.status }
    : {};
  const [items, total] = await Promise.all([
    prisma.subscriptionInvoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      select: INVOICE_SELECT
    }),
    prisma.subscriptionInvoice.count({ where })
  ]);
  return { items, total };
}

export async function approveInvoice(invoiceId: string) {
  const invoice = await prisma.subscriptionInvoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, status: true }
  });
  if (!invoice) throw new SubscriptionError('Invoice not found', 404);
  if (invoice.status !== PaymentStatus.MANUAL_REVIEW) {
    throw new SubscriptionError(`Invoice is ${invoice.status}`, 409);
  }
  await activateInvoice(invoice.id);
}

export async function rejectInvoice(invoiceId: string, reason?: string) {
  const { count } = await prisma.subscriptionInvoice.updateMany({
    where: { id: invoiceId, status: PaymentStatus.MANUAL_REVIEW },
    data: { status: PaymentStatus.FAILED, errorMessage: reason ?? 'rejected' }
  });
  if (count === 0) throw new SubscriptionError('Invoice not found', 404);
}

/** The supplier's own invoices (subscription page history). */
export async function listSupplierInvoices(supplierId: string, take = 10) {
  return prisma.subscriptionInvoice.findMany({
    where: { supplierId },
    orderBy: { createdAt: 'desc' },
    take,
    select: INVOICE_SELECT
  });
}
