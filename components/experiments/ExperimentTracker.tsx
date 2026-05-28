'use client';

import { useEffect } from 'react';

type Props = {
  experimentId: string;
  variantId: string;
  experimentKey: string;
};

/**
 * Fires a single IMPRESSION per (visitor, experiment) per browser tab
 * session. We dedupe via sessionStorage so:
 *   - reloads still re-impress (sessionStorage clears with the tab)
 *   - SPA navigation between two pages that mount the SAME experiment
 *     doesn't double-count
 *
 * Uses `navigator.sendBeacon` when available so the request is fire-
 * and-forget even if the user navigates away mid-flight. Falls back
 * to keepalive fetch.
 */
export function ExperimentTracker({ experimentId, variantId, experimentKey }: Props) {
  useEffect(() => {
    const flag = `ab_imp_${experimentKey}`;
    try {
      if (sessionStorage.getItem(flag)) return;
      sessionStorage.setItem(flag, variantId);
    } catch {
      // Private mode / storage disabled — proceed without dedupe.
    }

    const body = JSON.stringify({
      experimentId,
      variantId,
      type: 'IMPRESSION'
    });

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon('/api/experiments/track', blob);
        return;
      }
    } catch {
      // fall through to fetch
    }

    void fetch('/api/experiments/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true
    }).catch(() => {});
  }, [experimentId, variantId, experimentKey]);

  return null;
}
