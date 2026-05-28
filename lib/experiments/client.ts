'use client';

/**
 * Client-side helpers callers can use to record CLICK/CONVERSION events
 * without writing the fetch boilerplate themselves.
 *
 * Server-side conversion attribution (e.g. from a payment webhook)
 * should use `trackConversionForAllActive` from `lib/experiments/track`
 * instead — this helper is for instrumenting interactive elements.
 */

type Type = 'CLICK' | 'CONVERSION';

export function trackExperiment(
  experimentId: string,
  variantId: string,
  type: Type,
  value?: number
): void {
  const body = JSON.stringify({
    experimentId,
    variantId,
    type,
    ...(typeof value === 'number' ? { value } : {})
  });

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon('/api/experiments/track', blob);
      return;
    }
  } catch {
    /* fall through */
  }

  void fetch('/api/experiments/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true
  }).catch(() => {});
}
