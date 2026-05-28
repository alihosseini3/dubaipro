import 'server-only';

import { createHash } from 'node:crypto';

import { prisma } from '@/lib/prisma';

/**
 * Server-side conversion tracking.
 *
 * Two backends, both fire-and-forget:
 *
 *   • Meta Conversions API (CAPI): POST to graph.facebook.com so the
 *     conversion lands at Meta even when the visitor's browser blocks
 *     fbevents.js (iOS ATT, ad blockers, JS-disabled UA).
 *
 *   • Google Analytics 4 Measurement Protocol: closest server-side
 *     equivalent to Enhanced Conversions for GA4 + Google Ads. Hashed
 *     email goes through `user_data.sha256_email_address`. (For
 *     Google Ads Conversion API proper you need OAuth + customer id,
 *     which is intentionally out of scope for this lightweight path.)
 *
 * Both calls are deduplicated against the client pixels via the SAME
 * `event_id` / `transaction_id` = order id, exactly mirroring what
 * `<TrackEvent>` sends from the browser.
 *
 * Privacy: PII is SHA-256 hashed before leaving this process. We also
 * refuse to send anything for users who haven't granted consent
 * (`User.consentAt IS NULL`) when the marketing setting requires it.
 */

type PurchaseInput = {
  orderId: string;
  userId: string;
  value: number;
  currency: string;
  items: Array<{ id: string; quantity: number; price: number }>;
};

const META_API_VERSION = 'v18.0';

/** SHA-256 hex of a UTF-8 string (lowercased + trimmed for PII). */
function sha256Hex(input: string): string {
  return createHash('sha256').update(input.toLowerCase().trim()).digest('hex');
}

/**
 * Single retry with linear backoff. Total budget < 4s so a slow ad
 * network never holds up the payment webhook ACK (we always run this
 * via `void`, but bounded latency is still a kindness to the runtime).
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit
): Promise<{ ok: boolean; status: number; body: string }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(3000)
      });
      const body = await res.text().catch(() => '');
      if (res.ok) return { ok: true, status: res.status, body };
      // 4xx is our fault — never retry. Only retry transient 5xx / network.
      if (res.status < 500) return { ok: false, status: res.status, body };
    } catch (err) {
      if (attempt === 1) {
        return {
          ok: false,
          status: 0,
          body: err instanceof Error ? err.message : 'fetch_failed'
        };
      }
    }
    await new Promise((r) => setTimeout(r, 750));
  }
  return { ok: false, status: 0, body: 'exhausted' };
}

/**
 * Public entry point used by the payment service. Resolves all data
 * it needs internally (settings, user) so callers don't need to know
 * which backends are configured.
 */
export async function trackServerPurchase(input: PurchaseInput): Promise<void> {
  try {
    const settings = await prisma.marketingSettings
      .findUnique({ where: { id: 'default' } })
      .catch(() => null);
    if (!settings || !settings.trackingEnabled) return;

    const user = await prisma.user
      .findUnique({
        where: { id: input.userId },
        select: { email: true, consentAt: true }
      })
      .catch(() => null);
    if (!user) return;

    // Honour consent. Master switch alone is not enough when the
    // settings flag says so — mirrors the browser pixel logic.
    if (settings.requireConsent && !user.consentAt) return;

    const emailHash = sha256Hex(user.email);

    // Fire both networks in parallel. Each handles its own errors,
    // so one being down can't block the other.
    await Promise.allSettled([
      sendPurchaseToMeta({
        pixelId: settings.metaPixelId,
        accessToken: settings.metaAccessToken,
        testEventCode: settings.metaTestEventCode,
        emailHash,
        ...input
      }),
      sendPurchaseToGa4({
        measurementId: settings.ga4MeasurementId,
        apiSecret: settings.ga4ApiSecret,
        emailHash,
        ...input
      })
    ]);
  } catch (err) {
    // Never throw. The order is paid; tracking is a side-channel.
    console.warn('[server-tracking] purchase failed:', err);
  }
}

// ---------- Meta CAPI -------------------------------------------------

async function sendPurchaseToMeta(args: {
  pixelId: string | null;
  accessToken: string | null;
  testEventCode: string | null;
  emailHash: string;
  orderId: string;
  value: number;
  currency: string;
  items: PurchaseInput['items'];
}): Promise<void> {
  if (!args.pixelId || !args.accessToken) return;

  const body = {
    data: [
      {
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        // SAME id the browser sends → Meta de-dupes server vs. client.
        event_id: args.orderId,
        action_source: 'website',
        user_data: {
          em: [args.emailHash]
          // ph / client_ip_address / client_user_agent intentionally
          // omitted — webhook context has the gateway's IP/UA, not
          // the buyer's. Better to send less than send wrong.
        },
        custom_data: {
          currency: args.currency,
          value: Number(args.value.toFixed(2)),
          content_type: 'product',
          content_ids: args.items.map((i) => i.id),
          contents: args.items.map((i) => ({
            id: i.id,
            quantity: i.quantity,
            item_price: Number(i.price.toFixed(2))
          })),
          num_items: args.items.reduce((a, i) => a + i.quantity, 0),
          order_id: args.orderId
        }
      }
    ],
    ...(args.testEventCode ? { test_event_code: args.testEventCode } : {})
  };

  const url = `https://graph.facebook.com/${META_API_VERSION}/${args.pixelId}/events?access_token=${encodeURIComponent(args.accessToken)}`;
  const res = await fetchWithRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    console.warn('[capi] meta purchase failed', res.status, res.body.slice(0, 500));
  }
}

// ---------- GA4 Measurement Protocol ---------------------------------

async function sendPurchaseToGa4(args: {
  measurementId: string | null;
  apiSecret: string | null;
  emailHash: string;
  orderId: string;
  userId: string;
  value: number;
  currency: string;
  items: PurchaseInput['items'];
}): Promise<void> {
  if (!args.measurementId || !args.apiSecret) return;

  // GA4 needs a stable client_id per visitor. We fall back to the
  // user id since this is a logged-in checkout — slightly degrades
  // attribution quality when the same user spans devices but never
  // breaks event delivery.
  const body = {
    client_id: args.userId,
    user_id: args.userId,
    user_data: {
      sha256_email_address: args.emailHash
    },
    events: [
      {
        name: 'purchase',
        params: {
          transaction_id: args.orderId,
          value: Number(args.value.toFixed(2)),
          currency: args.currency,
          items: args.items.map((i) => ({
            item_id: i.id,
            quantity: i.quantity,
            price: Number(i.price.toFixed(2))
          }))
        }
      }
    ]
  };

  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(args.measurementId)}&api_secret=${encodeURIComponent(args.apiSecret)}`;
  const res = await fetchWithRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    console.warn('[ga4-mp] purchase failed', res.status, res.body.slice(0, 500));
  }
}
