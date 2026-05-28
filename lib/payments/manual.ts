import {
  PaymentError,
  type CreateIntentResult,
  type PaymentOrderInput,
  type PaymentProvider,
  type WebhookVerificationResult
} from './types';

/**
 * Manual provider — covers CARD_TRANSFER (Iran) and BANK_TRANSFER (intl).
 *
 * Flow:
 *   1. createIntent: nothing to call externally. We just allocate a
 *      reference id derived from our internal payment row and ask the
 *      checkout UI to render the bank-info / receipt-upload screen.
 *   2. There is no webhook — admin manually approves through
 *      `/admin/payments`. Approval calls `applyPaymentOutcome`.
 */
export const manualProvider: PaymentProvider = {
  name: 'manual',

  async createIntent(_order: PaymentOrderInput): Promise<CreateIntentResult> {
    // The route layer will pass the internal paymentId; that becomes
    // both `providerId` and the redirect target ("/manual/<paymentId>").
    // We keep the return generic — `manualCreateIntent` (below) is used
    // by the registry and supplies the payment id directly.
    throw new PaymentError(
      'provider_misconfigured',
      500,
      'manualCreateIntent must be invoked through the registry'
    );
  },

  verifyWebhook(): WebhookVerificationResult {
    return { ok: false, reason: 'manual_provider_has_no_webhook' };
  },

  parseOutcome() {
    return null;
  }
};

export async function manualCreateIntent(
  order: PaymentOrderInput,
  paymentId: string
): Promise<CreateIntentResult> {
  // Redirect to the dedicated checkout sub-step that shows account info
  // and accepts a receipt upload. The locale prefix is included by the
  // caller via successUrl/cancelUrl elsewhere; here we keep it neutral.
  const redirectUrl = `${order.successUrl.split('/orders/')[0]}/checkout/${order.id}/manual/${paymentId}`;
  return { paymentId, providerId: paymentId, redirectUrl };
}
