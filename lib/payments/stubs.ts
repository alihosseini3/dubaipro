/**
 * Stub providers for gateways that ship as scaffolding.
 *
 * Each provider conforms to the `PaymentProvider` contract so the rest
 * of the app (registry, factory, admin UI) treats them uniformly. The
 * actual external API integration is intentionally deferred — fill in
 * the TODO blocks with the gateway SDK call once production credentials
 * are issued. Until then, `createIntent` throws a clear, user-friendly
 * error that the checkout surfaces.
 *
 * This pattern keeps the system "modular & easy to add/remove gateways"
 * without exposing half-baked integrations to live customers.
 */
import {
  PaymentError,
  type CreateIntentResult,
  type PaymentOrderInput,
  type PaymentProvider,
  type WebhookVerificationResult
} from './types';

function notConfigured(name: string): never {
  throw new PaymentError(
    'provider_misconfigured',
    501,
    `${name} gateway is not configured. Set its env credentials and finish the integration in lib/payments/stubs.ts.`
  );
}

function makeStub(name: PaymentProvider['name']): PaymentProvider {
  return {
    name,
    async createIntent(_o: PaymentOrderInput): Promise<CreateIntentResult> {
      notConfigured(name);
    },
    verifyWebhook(): WebhookVerificationResult {
      return { ok: false, reason: 'not_configured' };
    },
    parseOutcome() {
      return null;
    }
  };
}

export const mellatProvider = makeStub('mellat');
export const zarinpalProvider = makeStub('zarinpal');
export const tapProvider = makeStub('tap');
export const paypalProvider = makeStub('paypal');

// ---- Per-gateway intent creators (called by the registry) ---------------
//
// These are called only after env credentials are present (the catalog
// in `methods.ts` already filters disabled methods). Replace the body
// with the real gateway call when wiring up each integration.

export async function mellatCreateIntent(
  order: PaymentOrderInput,
  paymentId: string
): Promise<CreateIntentResult> {
  // TODO: call Bank Mellat `bpPayRequest` SOAP endpoint, return RefId,
  // then redirect to https://bpm.shaparak.ir/pgwchannel/startpay.mellat
  void order;
  void paymentId;
  notConfigured('mellat');
}

export async function zarinpalCreateIntent(
  order: PaymentOrderInput,
  paymentId: string
): Promise<CreateIntentResult> {
  // TODO: POST https://api.zarinpal.com/pg/v4/payment/request.json
  void order;
  void paymentId;
  notConfigured('zarinpal');
}

export async function tapCreateIntent(
  order: PaymentOrderInput,
  paymentId: string
): Promise<CreateIntentResult> {
  // TODO: POST https://api.tap.company/v2/charges with TAP_SECRET_KEY
  void order;
  void paymentId;
  notConfigured('tap');
}

export async function paypalCreateIntent(
  order: PaymentOrderInput,
  paymentId: string
): Promise<CreateIntentResult> {
  // TODO: POST /v2/checkout/orders to PayPal REST API
  void order;
  void paymentId;
  notConfigured('paypal');
}
