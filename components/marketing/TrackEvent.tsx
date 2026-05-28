'use client';

import { useEffect, useRef } from 'react';

/**
 * Canonical event names. We map these to Google + Meta equivalents
 * inside the dispatcher so the rest of the codebase only ever speaks
 * one vocabulary.
 */
export type TrackEventName =
  | 'view_product'
  | 'add_to_cart'
  | 'initiate_checkout'
  | 'purchase';

export type TrackPayload = {
  productId?: string;
  productName?: string;
  category?: string;
  price?: number;
  currency?: string;
  quantity?: number;
  /** Order id — only meaningful for `purchase`. Used for dedup at the ad network. */
  orderId?: string;
  /** Total order value — only meaningful for `purchase`. */
  value?: number;
  items?: Array<{ id: string; name?: string; price?: number; quantity?: number }>;
};

/**
 * One-shot tracker. Mount it on a page that just rendered (e.g. the
 * product detail page or order success page) and it will push a single
 * event to the data layer + Google + Meta. Re-renders are guarded so
 * a parent re-render doesn't double-fire.
 */
export function TrackEvent({
  event,
  payload
}: {
  event: TrackEventName;
  payload: TrackPayload;
}) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    track(event, payload);
    // We intentionally exclude `payload` from deps — payloads arriving
    // by reference shouldn't re-fire if the parent re-renders with the
    // same logical content. Callers that need a re-fire should use a
    // `key` on the component to remount it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);

  return null;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

/**
 * Imperative tracking helper. Safe to call before pixels load — events
 * are pushed to `dataLayer` first (GTM-compatible) and `gtag/fbq` only
 * if those globals exist. No throw, ever.
 */
export function track(event: TrackEventName, payload: TrackPayload): void {
  if (typeof window === 'undefined') return;

  const currency = payload.currency ?? 'AED';

  // 1. Always feed the data layer — even if pixels are blocked, this
  //    powers GTM container deployments and our own analytics.
  try {
    (window.dataLayer = window.dataLayer || []).push({
      event,
      ecommerce: {
        currency,
        value: payload.value ?? payload.price ?? 0,
        transaction_id: payload.orderId,
        items: payload.items ?? buildItems(payload)
      }
    });
  } catch {
    /* noop */
  }

  // 2. Google Ads / GA4 — gtag uses GA4-style enhanced ecommerce names.
  try {
    if (typeof window.gtag === 'function') {
      const gName = GOOGLE_NAME[event];
      window.gtag('event', gName, {
        currency,
        value: payload.value ?? payload.price ?? 0,
        transaction_id: payload.orderId,
        items: payload.items ?? buildItems(payload)
      });
    }
  } catch {
    /* noop */
  }

  // 3. Meta Pixel — uses its own canonical event names.
  try {
    if (typeof window.fbq === 'function') {
      const mName = META_NAME[event];
      window.fbq('track', mName, {
        content_ids: payload.productId ? [payload.productId] : undefined,
        content_type: 'product',
        contents: (payload.items ?? buildItems(payload)).map((i) => ({
          id: i.id,
          quantity: i.quantity ?? 1
        })),
        value: payload.value ?? payload.price ?? 0,
        currency,
        ...(event === 'purchase' && payload.orderId
          ? { eventID: payload.orderId } // dedup with server-side CAPI later
          : {})
      });
    }
  } catch {
    /* noop */
  }
}

function buildItems(p: TrackPayload) {
  if (!p.productId) return [];
  return [
    {
      id: p.productId,
      name: p.productName,
      price: p.price,
      quantity: p.quantity ?? 1
    }
  ];
}

const GOOGLE_NAME: Record<TrackEventName, string> = {
  view_product: 'view_item',
  add_to_cart: 'add_to_cart',
  initiate_checkout: 'begin_checkout',
  purchase: 'purchase'
};

const META_NAME: Record<TrackEventName, string> = {
  view_product: 'ViewContent',
  add_to_cart: 'AddToCart',
  initiate_checkout: 'InitiateCheckout',
  purchase: 'Purchase'
};
