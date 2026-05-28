/**
 * Shared types for the modular payment system.
 *
 * Every provider (Stripe today; PayPal, crypto, local gateways tomorrow)
 * implements the same `PaymentProvider` contract so the rest of the app —
 * API routes, UI, webhook dispatch — stays 100% provider-agnostic.
 */

export type PaymentProviderName =
  | 'stripe'
  | 'paypal'
  | 'crypto'
  | 'manual'
  | 'mellat'
  | 'zarinpal'
  | 'tap';

/**
 * Minimum normalized order snapshot that any provider needs in order
 * to create a payment intent. Amount is a decimal in major units; the
 * adapter converts to the smallest unit (e.g. cents) when talking to
 * the gateway.
 */
export type PaymentOrderInput = {
  id: string;
  amount: number;
  currency: string;
  customerEmail: string | null;
  description: string;
  /** Absolute URL the gateway should redirect to after success. */
  successUrl: string;
  /** Absolute URL for user-cancelled / aborted payments. */
  cancelUrl: string;
};

/**
 * Result returned by `createIntent`. `redirectUrl` is used for hosted-
 * checkout providers (Stripe Checkout, PayPal); `clientSecret` is for
 * embedded flows (Stripe Elements). Both are optional — an adapter sets
 * whichever applies.
 */
export type CreateIntentResult = {
  /** Our internal Payment row id so the webhook can correlate. */
  paymentId: string;
  /** Provider-side identifier (e.g. Stripe session id). */
  providerId: string;
  redirectUrl?: string;
  clientSecret?: string;
};

export type WebhookVerificationResult =
  | {
      ok: true;
      /** Already-parsed event payload. */
      event: { type: string; data: unknown };
    }
  | { ok: false; reason: string };

/**
 * Normalized outcome extracted from a webhook event so callers don't
 * need to know gateway-specific shapes.
 */
export type PaymentOutcome = {
  providerId: string;
  status: 'PAID' | 'FAILED' | 'PROCESSING' | 'CANCELLED';
  errorMessage?: string;
  /** Amount charged in major units (e.g. 42.00), if reported. */
  amount?: number;
  currency?: string;
};

export interface PaymentProvider {
  readonly name: PaymentProviderName;

  /** Create a gateway-side payment intent for the given order. */
  createIntent(order: PaymentOrderInput): Promise<CreateIntentResult>;

  /** Verify the signature on an incoming webhook. */
  verifyWebhook(
    rawBody: string,
    signatureHeader: string | null
  ): Promise<WebhookVerificationResult> | WebhookVerificationResult;

  /**
   * Map a verified webhook event to a normalized outcome, or `null` if
   * the event is not payment-terminal (keep-alive, disputes, etc.).
   */
  parseOutcome(event: { type: string; data: unknown }): PaymentOutcome | null;
}

export class PaymentError extends Error {
  constructor(
    public code:
      | 'provider_misconfigured'
      | 'order_not_found'
      | 'order_not_payable'
      | 'provider_error'
      | 'webhook_invalid',
    public status: number,
    message?: string
  ) {
    super(message ?? code);
  }
}
