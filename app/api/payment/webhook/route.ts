import { NextResponse } from 'next/server';

import { applyPaymentOutcome } from '@/lib/payments/service';
import { getProvider } from '@/lib/payments/registry';
import { applySubscriptionOutcome } from '@/lib/subscriptions/billing';

export const runtime = 'nodejs';
/**
 * CRITICAL: disable all Next.js body parsing / caching. Webhook signature
 * verification must run against the byte-for-byte raw request body.
 */
export const dynamic = 'force-dynamic';

/**
 * POST /api/payment/webhook?provider=stripe
 *
 * Accepts webhook events from any registered gateway. Each gateway's
 * adapter is responsible for:
 *   1. verifying signature + timestamp (replay protection)
 *   2. parsing the event into a normalized `PaymentOutcome`
 *
 * We then apply the outcome idempotently to the Payment + Order rows.
 *
 * IMPORTANT: we must always return a 2xx response once the event is
 * verified, even if we've already processed it. Returning 5xx makes the
 * provider retry forever.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const providerName = url.searchParams.get('provider') ?? 'stripe';

  let provider;
  try {
    provider = getProvider(providerName);
  } catch {
    return NextResponse.json(
      { error: 'unknown_provider' },
      { status: 400 }
    );
  }

  // Read the raw body exactly as received. Do NOT use `request.json()`
  // here — re-serialization breaks HMAC.
  const rawBody = await request.text();

  const sigHeader =
    providerName === 'stripe'
      ? request.headers.get('stripe-signature')
      : request.headers.get('x-signature');

  const verification = await provider.verifyWebhook(rawBody, sigHeader);
  if (!verification.ok) {
    console.warn(`[webhook:${providerName}] rejected:`, verification.reason);
    return NextResponse.json(
      { error: 'invalid_signature', reason: verification.reason },
      { status: 400 }
    );
  }

  const outcome = provider.parseOutcome(verification.event);
  if (!outcome) {
    // Event is valid but not payment-terminal (e.g. charge.updated).
    // Acknowledge so the provider stops retrying.
    return NextResponse.json({ received: true, ignored: true });
  }

  try {
    // Subscription invoices share the gateway (and this webhook) with order
    // payments — route by which table owns the providerId. Invoice first
    // (cheap unique lookup); falls through to the order-payment handler.
    const handledAsSubscription = await applySubscriptionOutcome(outcome);
    if (!handledAsSubscription) {
      await applyPaymentOutcome(outcome);
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error(`[webhook:${providerName}] apply failed:`, err);
    // Return 500 so the provider retries — the event was legitimate and
    // our side is at fault.
    return NextResponse.json({ error: 'apply_failed' }, { status: 500 });
  }
}
