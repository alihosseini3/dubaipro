import { createHmac, timingSafeEqual } from 'node:crypto';

import {
  PaymentError,
  type CreateIntentResult,
  type PaymentOrderInput,
  type PaymentOutcome,
  type PaymentProvider,
  type WebhookVerificationResult
} from './types';

/**
 * Stripe adapter.
 *
 * Implemented with `fetch` + Node `crypto` — no `stripe` npm package.
 * This keeps the project dependency-free and aligns with the rest of
 * the platform (hand-rolled JWT, scrypt, etc.).
 *
 * Flow: we use **Stripe Checkout Sessions** (hosted page) so customers
 * never enter card details on our domain. Lower PCI scope + zero
 * client-side complexity.
 *
 * References (kept as inline comments for future maintainers):
 *   - Sessions: POST https://api.stripe.com/v1/checkout/sessions
 *   - Webhook verification: Stripe-Signature header using HMAC-SHA256
 *     over `t=<timestamp>.<rawBody>`
 */

const STRIPE_API_BASE = 'https://api.stripe.com/v1';
/** Accept webhooks up to 5 minutes old (protects against replay). */
const STRIPE_WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

/**
 * Currencies Stripe treats as zero-decimal (amount passed unscaled).
 * https://stripe.com/docs/currencies#zero-decimal
 */
const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG',
  'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF'
]);

function toStripeAmount(amount: number, currency: string): number {
  const upper = currency.toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(upper)) return Math.round(amount);
  return Math.round(amount * 100);
}

function fromStripeAmount(amount: number, currency: string): number {
  const upper = currency.toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(upper)) return amount;
  return amount / 100;
}

/**
 * Stripe accepts `application/x-www-form-urlencoded` with bracket/dot
 * notation for nested params (e.g. `line_items[0][price_data][currency]`).
 */
function encodeForm(params: Record<string, unknown>, prefix = ''): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const full = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (typeof item === 'object' && item !== null) {
          parts.push(encodeForm(item as Record<string, unknown>, `${full}[${i}]`));
        } else {
          parts.push(`${encodeURIComponent(`${full}[${i}]`)}=${encodeURIComponent(String(item))}`);
        }
      });
    } else if (typeof value === 'object') {
      parts.push(encodeForm(value as Record<string, unknown>, full));
    } else {
      parts.push(`${encodeURIComponent(full)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.filter(Boolean).join('&');
}

async function getSecretKey(): Promise<string> {
  const { getPaymentSettings } = await import('./settings');
  const settings = await getPaymentSettings();
  const key = settings.stripeSecretKey ?? process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new PaymentError(
      'provider_misconfigured',
      500,
      'Stripe secret key is not configured'
    );
  }
  return key;
}

async function getWebhookSecret(): Promise<string> {
  const { getPaymentSettings } = await import('./settings');
  const settings = await getPaymentSettings();
  const secret = settings.stripeWebhookSecret ?? process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new PaymentError(
      'provider_misconfigured',
      500,
      'Stripe webhook secret is not configured'
    );
  }
  return secret;
}

async function stripeRequest<T>(
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`${STRIPE_API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await getSecretKey()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': '2024-06-20'
    },
    body: encodeForm(body)
  });

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message =
      (json.error as { message?: string } | undefined)?.message ??
      `Stripe ${res.status}`;
    throw new PaymentError('provider_error', 502, message);
  }
  return json as T;
}

type StripeSession = {
  id: string;
  url: string;
  payment_intent: string | null;
  payment_status: string;
  amount_total: number | null;
  currency: string;
};

async function createCheckoutSession(
  order: PaymentOrderInput,
  paymentId: string
): Promise<CreateIntentResult> {
  const currency = order.currency.toLowerCase();
  const amountMinor = toStripeAmount(order.amount, order.currency);

  const payload: Record<string, unknown> = {
    mode: 'payment',
    success_url: `${order.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: order.cancelUrl,
    // Single synthetic line item — we've already snapshotted items in the
    // Order, and Stripe only needs a total + label for its UI.
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency,
          unit_amount: amountMinor,
          product_data: { name: order.description }
        }
      }
    ],
    // `client_reference_id` + `metadata.paymentId` let the webhook look
    // up our internal Payment row without trusting client input.
    client_reference_id: order.id,
    metadata: {
      orderId: order.id,
      paymentId
    }
  };

  if (order.customerEmail) {
    payload.customer_email = order.customerEmail;
  }

  const session = await stripeRequest<StripeSession>(
    '/checkout/sessions',
    payload
  );

  return {
    paymentId,
    providerId: session.id,
    redirectUrl: session.url
  };
}

/* ---------- webhook verification ------------------------------------- */

function parseSignatureHeader(
  header: string
): { timestamp: number; signatures: string[] } | null {
  // Format: `t=1700000000,v1=abc...,v1=def...,v0=legacy`
  const parts = header.split(',').map((p) => p.trim());
  let timestamp = 0;
  const signatures: string[] = [];
  for (const part of parts) {
    const [k, v] = part.split('=', 2);
    if (k === 't') timestamp = Number(v);
    else if (k === 'v1') signatures.push(v);
  }
  if (!timestamp || signatures.length === 0) return null;
  return { timestamp, signatures };
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

async function verifyStripeSignature(
  rawBody: string,
  header: string | null
): Promise<WebhookVerificationResult> {
  if (!header) return { ok: false, reason: 'missing_signature' };

  const parsed = parseSignatureHeader(header);
  if (!parsed) return { ok: false, reason: 'malformed_signature' };

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parsed.timestamp) > STRIPE_WEBHOOK_TOLERANCE_SECONDS) {
    return { ok: false, reason: 'timestamp_out_of_tolerance' };
  }

  const payload = `${parsed.timestamp}.${rawBody}`;
  const expected = createHmac('sha256', await getWebhookSecret())
    .update(payload)
    .digest('hex');

  const match = parsed.signatures.some((sig) => safeEqualHex(sig, expected));
  if (!match) return { ok: false, reason: 'signature_mismatch' };

  try {
    const event = JSON.parse(rawBody) as { type: string; data: unknown };
    return { ok: true, event };
  } catch {
    return { ok: false, reason: 'invalid_json' };
  }
}

/* ---------- outcome mapping ------------------------------------------ */

type StripeEventData = {
  object: Record<string, unknown>;
};

function mapOutcome(event: {
  type: string;
  data: unknown;
}): PaymentOutcome | null {
  const obj = (event.data as StripeEventData | undefined)?.object;
  if (!obj) return null;

  const providerId = String(obj.id ?? '');
  if (!providerId) return null;

  const currency =
    typeof obj.currency === 'string' ? obj.currency.toUpperCase() : undefined;
  const amountTotal =
    typeof obj.amount_total === 'number'
      ? obj.amount_total
      : typeof obj.amount === 'number'
        ? (obj.amount as number)
        : undefined;
  const amount =
    amountTotal !== undefined && currency
      ? fromStripeAmount(amountTotal, currency)
      : undefined;

  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const paymentStatus = obj.payment_status;
      if (paymentStatus === 'paid') {
        return { providerId, status: 'PAID', amount, currency };
      }
      if (paymentStatus === 'unpaid') {
        return { providerId, status: 'PROCESSING', amount, currency };
      }
      return { providerId, status: 'PROCESSING', amount, currency };
    }
    case 'checkout.session.async_payment_failed':
    case 'checkout.session.expired': {
      return {
        providerId,
        status: 'FAILED',
        amount,
        currency,
        errorMessage:
          event.type === 'checkout.session.expired'
            ? 'Checkout session expired'
            : 'Async payment failed'
      };
    }
    default:
      return null;
  }
}

export const stripeProvider: PaymentProvider = {
  name: 'stripe',
  async createIntent(order) {
    // The route handler created the Payment row before calling us and
    // passes its id as `order.id`… that would couple the provider too
    // tightly. Instead we accept an opaque `paymentId` via metadata on
    // the caller side — see `createPayment` in registry.
    throw new PaymentError(
      'provider_error',
      500,
      'Use createPayment() from the registry, not provider.createIntent directly'
    );
  },
  async verifyWebhook(rawBody, signatureHeader) {
    return verifyStripeSignature(rawBody, signatureHeader);
  },
  parseOutcome(event) {
    return mapOutcome(event);
  }
};

/** Internal helper exported for the registry/service layer. */
export async function stripeCreateIntent(
  order: PaymentOrderInput,
  paymentId: string
): Promise<CreateIntentResult> {
  return createCheckoutSession(order, paymentId);
}
